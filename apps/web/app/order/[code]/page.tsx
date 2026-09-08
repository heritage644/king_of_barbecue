import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PartyPopper, UserPlus } from 'lucide-react';
import { serverFetch } from '@/lib/server-api';
import type { Order } from '@kob/core';
import { OrderTracker } from '@/components/order-tracker';
import { Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params, searchParams }: { params: { code: string }; searchParams: { placed?: string } }) {
  const code = params.code.toUpperCase();
  const cookieHeader = cookies().toString();
  let order: Order;
  try {
    order = await serverFetch<{ order: Order }>(`/orders/${code}`, cookieHeader).then((r) => r.order);
  } catch {
    notFound();
  }

  // Live token: signed HMAC cookie set at checkout (or query token for logged-in
  // owners). Passed to the client only to open the SSE stream.
  const token = cookies().get(`kob_track_${code.toLowerCase()}`)?.value ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <PartyPopper className="h-8 w-8 text-brand" />
          <div>
            <h1 className="font-display text-3xl font-bold">Thanks, {order.guestName.split(' ')[0]}!</h1>
            <p className="text-neutral-500">Your order is in. We&apos;re on it.</p>
          </div>
        </div>
      </header>

      <OrderTracker initialOrder={order} code={code} trackingToken={token} />

      <section className="mt-8 rounded-xl border border-brand/30 bg-brand/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><UserPlus className="h-4 w-4 text-brand" /> Save your details for next time</h2>
            <p className="mt-1 text-sm text-neutral-600">Track all your orders in real time and check out faster.</p>
          </div>
          <Link href={`/create-account?order=${code}`}>
            <Button>Create free account</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
