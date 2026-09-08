import { AppError, Cart, CartItem, CartLine, Currency, MAX_ITEM_QUANTITY } from '@kob/core';
import { getRedis } from '../config/redis';
import { findProductsByIds, type ProductRow } from '../repositories/products';

/**
 * Guest cart: Redis hash `kob:cart:{cartId}` — field = productId, value =
 * JSON {productId, quantity, instructions}. TTL 7 days, refreshed on every
 * write. PostgreSQL is NOT touched per cart mutation; products are only
 * read at cart-view time to resolve names/prices/availability.
 *
 * Why Redis and not localStorage: cart state survives devices/tabs, is
 * authoritative for checkout, and the id travels in an httpOnly cookie so
 * it is invisible to client JS (non-sensitive id — documented in README).
 */
const CART_PREFIX = 'kob:cart:';
const CART_TTL_SECONDS = 7 * 24 * 3600;

export function cartKey(cartId: string): string {
  return `${CART_PREFIX}${cartId}`;
}

function parseItem(raw: string): CartItem | null {
  try {
    const parsed = JSON.parse(raw) as CartItem;
    if (!parsed.productId || !Number.isInteger(parsed.quantity) || parsed.quantity < 1) return null;
    return {
      productId: parsed.productId,
      quantity: Math.min(parsed.quantity, MAX_ITEM_QUANTITY),
      instructions: typeof parsed.instructions === 'string' ? parsed.instructions : '',
    };
  } catch {
    return null;
  }
}

export async function readCartItems(cartId: string): Promise<CartItem[]> {
  const raw = await getRedis().hgetall(cartKey(cartId));
  const items: CartItem[] = [];
  for (const value of Object.values(raw)) {
    const item = parseItem(value);
    if (item) items.push(item);
  }
  return items;
}

export async function getCart(cartId: string): Promise<Cart> {
  const items = await readCartItems(cartId);
  const products = await findProductsByIds(items.map((i) => i.productId));
  const lines: CartLine[] = [];
  let subtotalMinor = 0;
  let itemCount = 0;
  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) continue; // product removed — drop silently on next view
    const lineTotal = product.price_minor * item.quantity;
    subtotalMinor += lineTotal;
    itemCount += item.quantity;
    lines.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.image_url,
      unitPriceMinor: product.price_minor,
      quantity: item.quantity,
      instructions: item.instructions,
      lineTotalMinor: lineTotal,
      isAvailable: product.is_available,
    });
  }
  return {
    cartId,
    lines,
    subtotalMinor,
    itemCount,
    currency: Currency.NGN,
  };
}

export async function addCartItem(
  cartId: string,
  input: { productId: string; quantity: number; instructions: string },
): Promise<Cart> {
  const products = await findProductsByIds([input.productId]);
  const product = products.get(input.productId);
  if (!product) throw AppError.notFound('Product not found.');
  if (!product.is_available) throw AppError.unavailable(`"${product.name}" is currently unavailable.`);

  const key = cartKey(cartId);
  const existingRaw = await getRedis().hget(key, input.productId);
  const existing = existingRaw ? parseItem(existingRaw) : null;
  const nextQuantity = Math.min(
    MAX_ITEM_QUANTITY,
    (existing?.quantity ?? 0) + input.quantity,
  );
  await getRedis().hset(key, input.productId, JSON.stringify({
    productId: input.productId,
    quantity: nextQuantity,
    instructions: input.instructions || existing?.instructions || '',
  }));
  await getRedis().expire(key, CART_TTL_SECONDS);
  return getCart(cartId);
}

export async function updateCartItem(
  cartId: string,
  productId: string,
  input: { quantity: number; instructions?: string },
): Promise<Cart> {
  const key = cartKey(cartId);
  const raw = await getRedis().hget(key, productId);
  if (!raw) throw AppError.notFound('Item not in cart.');
  const existing = parseItem(raw);
  if (!existing) throw AppError.notFound('Item not in cart.');
  const updated: CartItem = {
    productId,
    quantity: input.quantity,
    instructions: input.instructions ?? existing.instructions,
  };
  await getRedis().hset(key, productId, JSON.stringify(updated));
  await getRedis().expire(key, CART_TTL_SECONDS);
  return getCart(cartId);
}

export async function removeCartItem(cartId: string, productId: string): Promise<Cart> {
  await getRedis().hdel(cartKey(cartId), productId);
  return getCart(cartId);
}

export async function clearCart(cartId: string): Promise<void> {
  await getRedis().del(cartKey(cartId));
}

export interface ResolvedCartLine {
  product: ProductRow;
  quantity: number;
  instructions: string;
}

export async function resolveCartForCheckout(cartId: string): Promise<ResolvedCartLine[]> {
  const items = await readCartItems(cartId);
  if (items.length === 0) throw AppError.cartEmpty();
  const products = await findProductsByIds(items.map((i) => i.productId));
  const lines: ResolvedCartLine[] = [];
  const problems: string[] = [];
  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      problems.push(`"${item.productId}" is no longer on the menu.`);
      continue;
    }
    if (!product.is_available) {
      problems.push(`"${product.name}" is currently unavailable.`);
      continue;
    }
    lines.push({ product, quantity: item.quantity, instructions: item.instructions });
  }
  if (problems.length > 0) {
    throw AppError.unavailable('Some items in your cart are no longer available.', { problems });
  }
  return lines;
}
