import type { Request, Response } from 'express';
import { ensureCartId, readCartCookie } from '../utils/cookies';
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
  clearCart,
} from '../services/cartService';

export async function getCartHandler(req: Request, res: Response): Promise<void> {
  const cartId = readCartCookie(req);
  const cart = cartId ? await getCart(cartId) : { cartId: null as string | null, lines: [], subtotalMinor: 0, itemCount: 0, currency: 'NGN' as const };
  res.json({ cart });
}

export async function addCartItemHandler(req: Request, res: Response): Promise<void> {
  const cartId = ensureCartId(req, res);
  const body = req.body as { productId: string; quantity: number; instructions: string };
  const cart = await addCartItem(cartId, body);
  res.status(201).json({ cart });
}

export async function updateCartItemHandler(req: Request, res: Response): Promise<void> {
  const cartId = ensureCartId(req, res);
  const { productId } = req.params as { productId: string };
  const body = req.body as { quantity: number; instructions?: string };
  const cart = await updateCartItem(cartId, productId, body);
  res.json({ cart });
}

export async function removeCartItemHandler(req: Request, res: Response): Promise<void> {
  const cartId = ensureCartId(req, res);
  const { productId } = req.params as { productId: string };
  const cart = await removeCartItem(cartId, productId);
  res.json({ cart });
}

export async function clearCartHandler(req: Request, res: Response): Promise<void> {
  const cartId = readCartCookie(req);
  if (cartId) await clearCart(cartId);
  res.json({ cart: { cartId: null, lines: [], subtotalMinor: 0, itemCount: 0, currency: 'NGN' } });
}
