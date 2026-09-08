import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, Printer, Truck } from 'lucide-react';
import { ApiError } from '@/lib/errors';
import { serverFetch } from '@/lib/server-api';
import type { Order } from '@kob/core';
import { formatDateTime, formatMoney, ORDER_STATUS_META, REASON_LABELS } from '@/lib/utils';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui';
import { OpsOrderActions } from '@/components/ops-order-actions';

export const dynamic = 'force-dynamic';

export default async function OpsOrderDetailPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const cookieHeader = cookies().toString();
  let order: Order;
  try {
    order = await serverFetch<{ order: Order }>(`/operations/orders/${code}`, cookieHeader).then((r) => r.order);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/ops" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Back to board
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-3xl font-bold">{order.publicCode}</h1>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">Placed {formatDateTime(order.createdAt)} · Updated {formatDateTime(order.updatedAt)}</p>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${order.guestPhone}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-bold hover:bg-neutral-50">
            <Phone className="h-4 w-4" /> <span className="hidden sm:inline">{order.guestPhone}</span><span className="sm:hidden">Call</span>
          </a>
          <a href={`/ops/orders/${order.publicCode}/print`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-bold hover:bg-neutral-50 no-print">
            <Printer className="h-4 w-4" /> Docket
          </a>
        </div>
      </div>

      <div className="mt-6">
        <OpsOrderActions order={order} onUpdated={() => undefined} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-bold">Items</h2>
          <ul className="mt-3 divide-y text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p><span className="font-semibold">{item.quantity}×</span> {item.name}</p>
                  {item.instructions && <p className="mt-0.5 text-xs italic text-neutral-500">“{item.instructions}”</p>}
                </div>
                <span className="font-medium">{formatMoney(item.unitPriceMinor * item.quantity)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between pt-3">
              <span className="text-neutral-500">Subtotal</span><span>{formatMoney(order.subtotalMinor)}</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="text-neutral-500">Delivery fee</span><span>{formatMoney(order.deliveryFeeMinor)}</span>
            </li>
            <li className="flex items-center justify-between py-2.5 text-base font-bold">
              <span>Total due</span><span>{formatMoney(order.totalMinor)}</span>
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-xs uppercase tracking-wide text-neutral-400">Name</dt><dd className="font-semibold">{order.guestName}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-neutral-400">Phone</dt><dd className="font-semibold">{order.guestPhone}</dd></div>
              {order.guestEmail && <div><dt className="text-xs uppercase tracking-wide text-neutral-400">Email</dt><dd className="break-words">{order.guestEmail}</dd></div>}
            </dl>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold"><Truck className="h-4 w-4" /> Fulfilment</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Method</dt><dd className="font-semibold">{order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}</dd></div>
              {order.fulfillmentMethod === 'DELIVERY' && (
                <>
                  <div className="flex justify-between gap-3"><dt className="shrink-0 text-neutral-500">Address</dt><dd className="text-right">{order.deliveryAddress}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500">Area</dt><dd className="font-semibold">{order.deliveryArea}</dd></div>
                  {order.deliveryInstructions && <div className="flex justify-between gap-3"><dt className="shrink-0 text-neutral-500">Driver note</dt><dd className="text-right italic">{order.deliveryInstructions}</dd></div>}
                </>
              )}
              {order.specialInstructions && <div className="flex justify-between gap-3"><dt className="shrink-0 text-neutral-500">Order note</dt><dd className="text-right italic">{order.specialInstructions}</dd></div>}
            </dl>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-bold">Timeline</h2>
        <ol className="mt-3 space-y-3 text-sm">
          {order.timeline.map((t) => (
            <li key={t.id} className="flex gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ORDER_STATUS_META[t.toStatus]?.dot ?? '#d4d4d4' }} />
              <div className="min-w-0">
                <p className="font-semibold">{ORDER_STATUS_META[t.toStatus]?.label ?? t.toStatus}{t.reasonCode ? ` — ${REASON_LABELS[t.reasonCode] ?? t.reasonCode}` : ''}</p>
                <p className="text-xs text-neutral-500">
                  {formatDateTime(t.createdAt)} · {t.actorType === 'SYSTEM' ? 'System' : (t.actorRole ?? 'Staff')}
                </p>
                {t.note && <p className="mt-0.5 text-xs italic text-neutral-600">“{t.note}”</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
