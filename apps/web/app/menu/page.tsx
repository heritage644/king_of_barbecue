import Image from 'next/image';
import Link from 'next/link';
import { serverFetch } from '@/lib/server-api';
import { formatMoney } from '@/lib/utils';
import type { Product, ProductCategory } from '@kob/core';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  let categories: ProductCategory[] = [];
  let products: Product[] = [];
  try {
    const [c, p] = await Promise.all([
      serverFetch<{ categories: ProductCategory[] }>('/categories'),
      serverFetch<{ products: Product[] }>('/products'),
    ]);
    categories = c.categories;
    products = p.products;
  } catch {
    // fall through to empty state
  }

  const groups = categories
    .map((cat) => ({ category: cat, items: products.filter((p) => p.categoryId === cat.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">The menu</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Order your favourites</h1>
        <p className="mt-2 max-w-xl text-neutral-500">Every dish is grilled to order. Add a note — no pepper, extra sauce — and we&apos;ll take care of it.</p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-16 text-center text-neutral-500">
          The menu is being refreshed. Please check back shortly.
        </div>
      ) : (
        <div className="space-y-14">
          {groups.map(({ category, items }) => (
            <section key={category.id} id={category.slug} aria-labelledby={`${category.slug}-heading`}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 id={`${category.slug}-heading`} className="font-display text-2xl font-bold">{category.name}</h2>
                <span className="text-sm text-neutral-400">{category.description}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <Link
                    key={p.id}
                    href={`/menu/${p.slug}`}
                    className="group flex gap-4 rounded-xl border border-neutral-200 bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      {p.imageUrl ? (
                        <Image src={p.imageUrl} alt={p.name} fill sizes="96px" className="object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-neutral-400">No photo</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-snug group-hover:text-brand">{p.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{p.description}</p>
                      <p className="mt-2 font-bold">{formatMoney(p.priceMinor)}</p>
                      {!p.isAvailable && <p className="mt-1 text-xs font-semibold text-red-600">Currently unavailable</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
