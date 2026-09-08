import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Flame } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import { formatMoney } from '@/lib/utils';
import type { Product } from '@kob/core';
import { AddToCartForm } from '@/components/product-interactions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const { product } = await serverFetch<{ product: Product }>(`/products/${params.slug}`);
    return { title: product.name, description: product.description ?? undefined };
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  let product: Product;
  try {
    product = await serverFetch<{ product: Product }>(`/products/${params.slug}`).then((r) => r.product);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/menu" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </Link>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-neutral-100">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} fill priority sizes="50vw" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-400">No photo yet</div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">{product.categoryName}</p>
          <h1 className="mt-1 font-display text-4xl font-bold">{product.name}</h1>
          <p className="mt-4 text-lg text-neutral-600">{product.description}</p>
          <p className="mt-6 text-3xl font-bold">{formatMoney(product.priceMinor)}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
            <Flame className="h-4 w-4 text-brand-light" /> Grilled to order on real charcoal
          </div>
          {product.isAvailable ? (
            <AddToCartForm productId={product.id} />
          ) : (
            <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              This item is currently unavailable.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
