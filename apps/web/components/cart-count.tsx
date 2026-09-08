import { serverFetch } from '@/lib/server-api';

export async function CartCount({ cookieHeader }: { cookieHeader: string }) {
  try {
    const data = await serverFetch<{ cart: { itemCount: number } }>('/cart', cookieHeader, { cache: 'no-store' });
    const count = data.cart?.itemCount ?? 0;
    if (count === 0) return null;
    return (
      <span className="rounded-full bg-white/20 px-1.5 text-xs font-bold" aria-label={`${count} items in cart`}>
        {count}
      </span>
    );
  } catch {
    return null;
  }
}
