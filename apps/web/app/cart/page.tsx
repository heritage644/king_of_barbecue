import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import { formatMoney } from '@/lib/utils';
import type { Cart } from '@kob/core';
import { CartLineControls } from '@/components/product-interactions';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  let cart: Cart | null = null;
  try {
    cart = await serverFetch<{ cart: Cart }>('/cart', cookies().toString()).then((r) => r.cart);
  } catch {
    cart = null;
  }

  const lines = cart?.lines ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold">Your cart</h1>
      {lines.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white p-16 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-neutral-300" />
          <h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2>
          <p className="mt-1 text-neutral-500">Time to fix that — the grill is hot.</p>
          <Link href="/menu" className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark">
            Browse the menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={line.productId} className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-card">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {line.imageUrl ? (
                    <Image src={line.imageUrl} alt={line.name} fill sizes="80px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">No photo</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-2">
                  <div>
                    <Link href={`/menu/${line.slug}`} className="font-semibold hover:text-brand">{line.name}</Link>
                    <p className="text-sm text-neutral-500">{formatMoney(line.unitPriceMinor)} each</p>
                  </div>
                  <CartLineControls cart={{ cartId: cart!.cartId } as Cart} productId={line.productId} initialQty={line.quantity} initialInstructions={line.instructions} />
                </div>
                <p className="self-start font-bold">{formatMoney(line.lineTotalMinor)}</p>
              </li>
            ))}
          </ul>
          <aside className="h-fit rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-lg font-bold">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt>Items</dt><dd>{cart?.itemCount ?? 0}</dd></div>
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{formatMoney(cart?.subtotalMinor ?? 0)}</dd></div>
              <div className="flex justify-between text-neutral-500"><dt>Delivery fee</dt><dd>Calculated at checkout</dd></div>
            </dl>
            <Link href="/checkout" className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark">
              Checkout <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-xs text-neutral-400">Checkout stays open to guests — no account needed.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
