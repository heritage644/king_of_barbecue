'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Loader2, Printer, Search, Truck, WifiOff, X } from 'lucide-react';
import type { OrderSummary, OrderStatus, PaymentStatus, FulfillmentMethod } from '@kob/core';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn, formatDuration, formatMoney, ORDER_STATUS_META, PAYMENT_STATUS_META, REASON_LABELS } from '@/lib/utils';
import { OrderStatusBadge, PaymentStatusBadge, Button, Input, Select, Skeleton } from '@/components/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/tabs';
import { playOrderChime, useNow, useOpsStream, useLocalStorage, type OpsStreamEvent } from '@/lib/hooks';

const COLUMNS: Array<{ key: string; label: string; statuses: OrderStatus[] }> = [
  { key: 'new', label: 'New / Pending', statuses: ['PENDING'] },
  { key: 'progress', label: 'In Progress', statuses: ['APPROVED', 'IN_PREPARATION', 'READY'] },
  { key: 'out', label: 'Out for Delivery', statuses: ['OUT_FOR_DELIVERY'] },
  { key: 'done', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'closed', label: 'Failed / Cancelled', statuses: ['REJECTED', 'FAILED', 'CANCELLED'] },
];

/** High-performance order board: desktop kanban, mobile tabbed columns. */
export function OpsBoard({ initialOrders, initialCursor }: { initialOrders: OrderSummary[]; initialCursor: string | null }) {
  const [orders, setOrders] = useState(initialOrders);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [soundOn, setSoundOn] = useLocalStorage('kob_sound', true);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const now = useNow(1000);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const r = await apiClient.listOpsOrders(params.toString());
      setOrders(r.items);
      setCursor(r.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load orders.');
    }
  }, []);

  const onEvent = useCallback(
    ({ event, isNewOrder }: OpsStreamEvent) => {
      if (event.type === 'store.updated') return;
      if (isNewOrder && soundOnRef.current) playOrderChime();
      if (isNewOrder) {
        setNewOrderFlash(true);
        if (alertTimer.current) clearTimeout(alertTimer.current);
        alertTimer.current = setTimeout(() => setNewOrderFlash(false), 6000);
      }
      // Update/insert in place — cheap, no full reload, no flicker.
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === event.orderId);
        if (idx === -1) {
          void refresh();
          return prev;
        }
        const next = prev.slice();
        next[idx] = {
          ...next[idx]!,
          status: event.status,
          paymentStatus: event.paymentStatus,
        };
        return next;
      });
    },
    [refresh],
  );

  const { connected } = useOpsStream(onEvent);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (q && !(o.publicCode.toLowerCase().includes(q.toLowerCase()) || o.guestName.toLowerCase().includes(q.toLowerCase()) || o.guestPhone.includes(q))) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (payFilter && o.paymentStatus !== payFilter) return false;
      if (methodFilter && o.fulfillmentMethod !== methodFilter) return false;
      return true;
    });
  }, [orders, q, statusFilter, payFilter, methodFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, OrderSummary[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const o of filtered) {
      const col = COLUMNS.find((c) => c.statuses.includes(o.status));
      if (col) map.get(col.key)!.push(o);
    }
    for (const col of COLUMNS) {
      map.get(col.key)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return map;
  }, [filtered]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const [k, v] of grouped) c.set(k, v.length);
    return c;
  }, [grouped]);

  const total = filtered.length;
  const unpaid = orders.filter((o) => o.paymentStatus === 'UNPAID').length;

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor });
      const r = await apiClient.listOpsOrders(params.toString());
      setOrders((prev) => [...prev, ...r.items]);
      setCursor(r.nextCursor);
    } catch {
      // try again later
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="p-4">
      {/* Status summary + connection + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
          <span className={cn('h-2.5 w-2.5 rounded-full', connected ? 'bg-green-500' : 'bg-red-500', !connected && 'animate-pulse')} />
          {connected ? 'Live' : 'Reconnecting…'}
          {!connected && <WifiOff className="h-3.5 w-3.5 text-red-500" />}
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
          <span className="font-bold">{total}</span> orders <span className="text-neutral-400">·</span> <span className="font-semibold text-amber-600">{unpaid}</span> unpaid
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Order ID, customer name or phone"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.values(ORDER_STATUS_META).map((m) => (
            <option key={m.label} value={Object.keys(ORDER_STATUS_META).find((k) => ORDER_STATUS_META[k as OrderStatus].label === m.label)}>{m.label}</option>
          ))}
        </Select>
        <Select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} aria-label="Filter by payment">
          <option value="">All payments</option>
          {Object.entries(PAYMENT_STATUS_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </Select>
        <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} aria-label="Filter by fulfillment">
          <option value="">All fulfilment</option>
          <option value="PICKUP">Pickup</option>
          <option value="DELIVERY">Delivery</option>
        </Select>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error} <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Kanban (desktop) */}
      <div className="hidden gap-4 lg:grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
        {COLUMNS.map((col) => (
          <BoardColumn key={col.key} column={col} orders={grouped.get(col.key) ?? []} count={counts.get(col.key) ?? 0} now={now} />
        ))}
      </div>

      {/* Tabbed (mobile/tablet portrait) */}
      <div className="lg:hidden">
        <Tabs defaultValue="new">
          <TabsList className="w-full justify-start overflow-x-auto">
            {COLUMNS.map((col) => (
              <TabsTrigger key={col.key} value={col.key} className="shrink-0">
                {col.label} <span className="ml-1 rounded-full bg-neutral-200 px-1.5 text-[10px]">{counts.get(col.key) ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {COLUMNS.map((col) => (
            <TabsContent key={col.key} value={col.key}>
              <div className="grid gap-3 sm:grid-cols-2">
                {(grouped.get(col.key) ?? []).map((o) => (
                  <OrderCard key={o.id} order={o} now={now} />
                ))}
                {(grouped.get(col.key) ?? []).length === 0 && (
                  <p className="col-span-full py-8 text-center text-sm text-neutral-400">No orders here.</p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {cursor && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Load more
          </Button>
        </div>
      )}

      {newOrderFlash && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white shadow-xl animate-pulse-ring">
          <Bell className="mr-1.5 inline h-4 w-4" /> New order!
        </div>
      )}
    </div>
  );
}

function BoardColumn({ column, orders, count, now }: { column: { key: string; label: string }; orders: OrderSummary[]; count: number; now: number }) {
  return (
    <div className="flex min-h-[60vh] flex-col rounded-xl bg-neutral-200/60 p-2">
      <div className="flex items-center justify-between px-2 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-600">{column.label}</h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">{count}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {(orders.length ? orders : []).map((o) => (
          <OrderCard key={o.id} order={o} now={now} />
        ))}
        {orders.length === 0 && <p className="py-8 text-center text-xs text-neutral-400">— nothing here —</p>}
      </div>
    </div>
  );
}

function OrderCard({ order, now }: { order: OrderSummary; now: number }) {
  const elapsed = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 1000));
  const warning = elapsed >= 10 * 60;
  const critical = elapsed >= 20 * 60;
  const closed = ['COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(order.status);
  const actions = ['PENDING', 'APPROVED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY'].includes(order.status);

  return (
    <div className={cn(
      'rounded-lg border bg-white p-3 shadow-sm transition',
      critical && actions ? 'border-red-300 bg-red-50/60' : warning && actions ? 'border-amber-300 bg-amber-50/60' : 'border-neutral-200',
    )}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/ops/orders/${order.publicCode}`} className="font-mono text-sm font-bold text-brand hover:underline">
          {order.publicCode}
        </Link>
        {!closed && (
          <span className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[11px] font-bold',
            critical ? 'bg-red-600 text-white' : warning ? 'bg-amber-500 text-white' : 'bg-neutral-100 text-neutral-600',
          )}>
            {formatDuration(elapsed)}
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-neutral-500">{order.guestName} · {order.guestPhone}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
        {order.fulfillmentMethod === 'DELIVERY' && <Truck className="h-3.5 w-3.5 text-neutral-400" />}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{order.itemCount} items</span>
        <span className="font-bold text-charcoal">{formatMoney(order.totalMinor)}</span>
      </div>
      {order.rejectionReasonCode && (
        <p className="mt-1 truncate text-[11px] text-red-600">{REASON_LABELS[order.rejectionReasonCode] ?? order.rejectionReasonCode}</p>
      )}
      <Link href={`/ops/orders/${order.publicCode}/print`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-brand no-print">
        <Printer className="h-3 w-3" /> Docket
      </Link>
    </div>
  );
}

export function OpsBoardSkeleton() {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl bg-neutral-200/60 p-3">
          {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-28 w-full" />)}
        </div>
      ))}
    </div>
  );
}
