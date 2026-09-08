'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { Order, OrderEvent, OrderStatus } from '@kob/core';
import { cn, formatMoney, ORDER_STATUS_META } from '@/lib/utils';
import { useOrderStream } from '@/lib/hooks';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui';

const PROGRESS: OrderStatus[] = ['PENDING', 'APPROVED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];

/**
 * Real-time order tracker. Initial state comes from the server component;
 * SSE events immediately update status/payment + progress, no polling.
 */
export function OrderTracker({ initialOrder, code, trackingToken }: { initialOrder: Order; code: string; trackingToken: string | null }) {
  const [order, setOrder] = useState(initialOrder);
  const [flash, setFlash] = useState(false);

  const onEvent = (event: OrderEvent) => {
    setOrder((prev) => ({
      ...prev,
      status: event.status,
      paymentStatus: event.paymentStatus,
      updatedAt: event.emittedAt,
      timeline: event.status === prev.status && event.paymentStatus === prev.paymentStatus
        ? prev.timeline
        : [
            ...prev.timeline,
            {
              id: event.eventId,
              fromStatus: prev.status,
              toStatus: event.status,
              actorType: 'SYSTEM',
              actorUserId: null,
              actorRole: null,
              reasonCode: event.reasonCode ?? null,
              note: event.note ?? null,
              metadata: {},
              createdAt: event.emittedAt,
            },
          ],
    }));
    setFlash(true);
    setTimeout(() => setFlash(false), 800);
  };

  const { connected } = useOrderStream(code, trackingToken, onEvent);

  const terminal = ['COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(order.status);
  const currentIndex = PROGRESS.indexOf(order.status);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-3xl font-bold">Order {order.publicCode}</h2>
          <OrderStatusBadge status={order.status} className={flash ? 'animate-pulse-ring' : ''} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className={cn('flex items-center gap-1.5 text-xs font-medium', connected ? 'text-green-600' : 'text-neutral-400')}>
          {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {connected ? 'Live updates' : 'Connecting…'}
        </p>
      </div>

      {!terminal && (
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Order progress">
          {PROGRESS.map((step, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
            return (
              <li key={step} className="flex flex-col items-center gap-2 text-center">
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold',
                    state === 'done' && 'border-green-600 bg-green-600 text-white',
                    state === 'current' && 'border-brand bg-brand text-white animate-pulse-ring',
                    state === 'todo' && 'border-neutral-300 bg-white text-neutral-400',
                  )}
                >
                  {state === 'done' ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </span>
                <span className={cn('text-[11px] font-medium leading-tight', state === 'todo' ? 'text-neutral-400' : 'text-charcoal')}>
                  <span className="hidden sm:block">{ORDER_STATUS_META[step].label}</span>
                  <span className="sm:hidden">{short(step)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {order.status === 'REJECTED' && (
        <RejectionNotice order={order} />
      )}
      {order.status === 'FAILED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-semibold text-red-800">This order could not be completed.</p>
          <p className="mt-1 text-sm text-red-700">{lastNote(order) || 'Please contact us and we will make it right.'}</p>
        </div>
      )}
      {order.status === 'CANCELLED' && (
        <div className="rounded-xl border border-neutral-300 bg-neutral-50 px-5 py-4">
          <p className="font-semibold text-neutral-800">This order was cancelled.</p>
          <p className="mt-1 text-sm text-neutral-600">{lastNote(order) || 'Contact us if you have questions.'}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
          <h3 className="font-bold">Items</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-semibold">{item.quantity}× {item.name}</span>
                  {item.instructions && <span className="block text-xs italic text-neutral-500">“{item.instructions}”</span>}
                </span>
                <span className="font-medium">{formatMoney(item.unitPriceMinor * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotalMinor)}</dd></div>
            <div className="flex justify-between"><dt>Delivery fee</dt><dd>{formatMoney(order.deliveryFeeMinor)}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatMoney(order.totalMinor)}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
          <h3 className="font-bold">Details</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-neutral-500">Fulfilment</dt><dd className="font-medium">{order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Placed</dt><dd className="font-medium">{new Date(order.createdAt).toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Name</dt><dd className="font-medium">{order.guestName}</dd></div>
            {order.fulfillmentMethod === 'DELIVERY' && (
              <>
                <div className="flex justify-between gap-4"><dt className="shrink-0 text-neutral-500">Address</dt><dd className="text-right font-medium">{order.deliveryAddress}, {order.deliveryArea}</dd></div>
                {order.deliveryInstructions && <div className="flex justify-between gap-4"><dt className="shrink-0 text-neutral-500">Driver note</dt><dd className="text-right font-medium">{order.deliveryInstructions}</dd></div>}
              </>
            )}
          </dl>
          <h4 className="mt-5 text-sm font-bold">Timeline</h4>
          <ol className="mt-2 space-y-2">
            {order.timeline.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-xs text-neutral-500">
                <span className={cn('h-2 w-2 rounded-full', ORDER_STATUS_META[t.toStatus]?.dot ?? 'bg-neutral-300')} />
                <span className="font-semibold text-charcoal">{ORDER_STATUS_META[t.toStatus]?.label ?? t.toStatus}</span>
                <span>{new Date(t.createdAt).toLocaleTimeString()}</span>
                {t.note && <span className="italic">— {t.note}</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function short(status: OrderStatus): string {
  switch (status) {
    case 'IN_PREPARATION': return 'Prep';
    case 'OUT_FOR_DELIVERY': return 'Out';
    default: return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

function lastNote(order: Order): string | null {
  const last = order.timeline[order.timeline.length - 1];
  return last?.note ?? null;
}

function RejectionNotice({ order }: { order: Order }) {
  const reason = order.timeline[order.timeline.length - 1]?.reasonCode;
  const labels: Record<string, string> = {
    ITEM_OUT_OF_STOCK: 'One or more items are out of stock.',
    DELIVERY_ZONE_UNAVAILABLE: 'We are unable to deliver to that location right now.',
    SUSPICIOUS_ACTIVITY: 'We could not verify this order.',
    RESTAURANT_CAPACITY: 'We are at capacity and could not accept the order.',
    OTHER: 'We could not fulfil this order.',
  };
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
      <p className="font-semibold text-red-800">Sorry — this order was rejected.</p>
      <p className="mt-1 text-sm text-red-700">{reason ? (labels[reason] ?? 'We could not fulfil this order.') : 'We could not fulfil this order.'}</p>
      {lastNote(order) && <p className="mt-1 text-sm text-red-600 italic">Note: {lastNote(order)}</p>}
    </div>
  );
}
