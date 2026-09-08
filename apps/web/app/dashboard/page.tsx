import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PackageOpen } from 'lucide-react';
import { ApiError } from '@/lib/errors';
import { serverFetch } from '@/lib/server-api';
import type { Order, Page, PublicUser } from '@kob/core';
import { formatMoney, formatDateTime, ORDER_STATUS_META } from '@/lib/utils';
import { OrderStatusBadge, PaymentStatusBadge, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieHeader = cookies().toString();
  let user: PublicUser;
  let page: Page<Order>;
  try {
    user = await serverFetch<{ user: PublicUser }>('/auth/me', cookieHeader).then((r) => r.user);
    page = await serverFetch<Page<Order>>('/account/orders', cookieHeader);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    redirect('/login');
  }

  const active = page.items.filter((o) => !['COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(o.status));
  const history = page.items.filter((o) => ['COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(o.status));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold">My orders</h1>
      <p className="mt-1 text-neutral-500">Welcome back, {user.fullName.split(' ')[0]}.</p>

      {page.items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white p-16 text-center">
          <PackageOpen className="mx-auto h-10 w-10 text-neutral-300" />
          <h2 className="mt-4 text-lg font-semibold">No orders yet</h2>
          <p className="mt-1 text-neutral-500">Your orders will appear here — including ones placed as a guest with this email.</p>
          <Link href="/menu" className="mt-6 inline-block">
            <Button size="lg">Order now</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">Active</h2>
              <ul className="space-y-3">
                {active.map((o) => (
                  <OrderCard key={o.id} order={o} live />
                ))}
              </ul>
            </section>
          )}
          {history.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">History</h2>
              <ul className="space-y-3">
                {history.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, live = false }: { order: Order; live?: boolean }) {
  return (
    <li className={`rounded-xl border bg-white p-5 shadow-card ${live ? 'border-brand/40' : 'border-neutral-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/order/${order.publicCode}`} className="font-bold hover:text-brand">{order.publicCode}</Link>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'} · {formatDateTime(order.createdAt)} ·{' '}
            {order.items.reduce((n, i) => n + i.quantity, 0)} items
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{formatMoney(order.totalMinor)}</p>
          {live && <p className="text-xs font-semibold text-brand">{ORDER_STATUS_META[order.status].description}</p>}
        </div>
      </div>
      {live && (
        <Link href={`/order/${order.publicCode}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
          Track live →
        </Link>
      )}
    </li>
  );
}
