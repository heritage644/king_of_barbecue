'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Printer, X } from 'lucide-react';
import type { Order, OrderStatus, PaymentStatus } from '@kob/core';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn, formatMoney, ORDER_STATUS_META } from '@/lib/utils';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/dialog';

const STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'IN_PREPARATION', label: 'Preparing' },
  { status: 'READY', label: 'Ready' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out to Deliver' },
  { status: 'COMPLETED', label: 'Completed' },
];

const REJECT_REASONS = [
  { value: 'ITEM_OUT_OF_STOCK', label: 'Item out of stock' },
  { value: 'DELIVERY_ZONE_UNAVAILABLE', label: 'Delivery area not available' },
  { value: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious activity' },
  { value: 'RESTAURANT_CAPACITY', label: 'Kitchen at capacity' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * All state transitions go through the API; the API enforces the centralized
 * state machine and appends timeline entries. Buttons only fire allowed moves.
 */
export function OpsOrderActions({ order: initialOrder, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const [order, setOrder] = useState(initialOrder);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const currentIdx = useMemo(() => STEPS.findIndex((s) => s.status === order.status), [order.status]);
  const terminal = ['REJECTED', 'FAILED', 'CANCELLED', 'COMPLETED'].includes(order.status);
  const isPending = order.status === 'PENDING';
  const isInProgress = ['APPROVED', 'IN_PREPARATION', 'READY'].includes(order.status);

  function apply(next: Order) {
    setOrder(next);
    onUpdated(next);
  }

  async function run(name: string, fn: () => Promise<Order>) {
    setBusy(name);
    setError(null);
    try {
      apply(await fn());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function advance() {
    const next: OrderStatus =
      order.status === 'APPROVED' ? 'IN_PREPARATION'
      : order.status === 'IN_PREPARATION' ? 'READY'
      : order.status === 'READY' ? 'OUT_FOR_DELIVERY'
      : order.status === 'OUT_FOR_DELIVERY' ? 'COMPLETED'
      : order.status === 'PENDING' ? 'APPROVED'
      : order.status;
    if (next === order.status || next === 'CANCELLED' || next === 'FAILED' || next === 'REJECTED') return;
    await run('advance', () => apiClient.transitionOrder(order.publicCode, next));
  }

  async function markUnpaid() {
    await run('unpaid', () => apiClient.setPaymentStatus(order.publicCode, 'UNPAID'));
  }
  async function markPaid() {
    await run('paid', () => apiClient.setPaymentStatus(order.publicCode, 'PAID'));
  }

  async function submitReject(e: React.FormEvent) {
    e.preventDefault();
    setRejectBusy(true);
    setError(null);
    try {
      apply(await apiClient.rejectOrder(order.publicCode, rejectReason, rejectNote || undefined));
      setRejectOpen(false);
      setRejectReason('');
      setRejectNote('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject order.');
    } finally {
      setRejectBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700" role="alert">{error}</div>
      )}

      {/* Progress steps (only for lifecycle orders) */}
      {!terminal && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <ol className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((step, i) => {
              const done = i <= currentIdx;
              const isCurrent = i === currentIdx;
              const disabled = isCurrent || i > currentIdx + 1 || order.status === 'OUT_FOR_DELIVERY'; // no skipping
              return (
                <li key={step.status} className="flex min-w-0 flex-1 items-center">
                  <button
                    disabled={disabled}
                    onClick={() => run('advance', () => apiClient.transitionOrder(order.publicCode, step.status))}
                    className={cn(
                      'flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold transition',
                      done ? 'text-green-700' : 'text-neutral-400',
                      isCurrent && 'bg-brand/10 text-brand',
                      !disabled && !isCurrent && 'hover:bg-neutral-100 hover:text-brand',
                    )}
                  >
                    <span className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
                      done ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-500',
                    )}>
                      {done && !isCurrent ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="truncate">{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <span className="mx-1 h-px min-w-2 flex-1 bg-neutral-200" />}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isPending && (
          <Button size="lg" disabled={busy === 'advance'} onClick={() => void advance()} className="h-12 flex-1 min-w-[140px] md:flex-none">
            {busy === 'advance' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve order
          </Button>
        )}
        {isInProgress && (
          <Button size="lg" disabled={busy === 'advance'} onClick={() => void advance()} className="h-12 flex-1 min-w-[140px] md:flex-none">
            {busy === 'advance' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {order.status === 'APPROVED' ? 'Start preparing' : order.status === 'IN_PREPARATION' ? 'Mark ready' : order.status === 'READY' ? 'Send out' : 'Complete order'}
          </Button>
        )}
        {order.status === 'OUT_FOR_DELIVERY' && (
          <Button size="lg" disabled={busy === 'advance'} onClick={() => void advance()} className="h-12 flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 md:flex-none">
            {busy === 'advance' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark delivered
          </Button>
        )}
        {!terminal && (
          <>
            {order.paymentStatus === 'UNPAID' ? (
              <Button size="lg" variant="outline" disabled={busy === 'paid'} onClick={() => void markPaid()} className="h-12">
                {busy === 'paid' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Mark paid · {formatMoney(order.totalMinor)}
              </Button>
            ) : (
              <Button size="lg" variant="outline" disabled={busy === 'unpaid'} onClick={() => void markUnpaid()} className="h-12">
                {busy === 'unpaid' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Mark unpaid
              </Button>
            )}
          </>
        )}
        {!terminal && (
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="destructive" className="h-12">
                <X className="h-4 w-4" /> Reject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject order {order.publicCode}</DialogTitle>
                <p className="text-sm text-neutral-500">Rejection is permanent and is recorded in the order timeline. If money was taken, raise a refund request separately.</p>
              </DialogHeader>
              <form onSubmit={(e) => void submitReject(e)} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Reason *</label>
                  <Select required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                    <option value="" disabled>Select a reason…</option>
                    {REJECT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Note for customer (optional)</label>
                  <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} maxLength={300} placeholder="e.g. We sold out of plantain today — we would love to make it up to you." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={rejectBusy}>
                    {rejectBusy && <Loader2 className="h-4 w-4 animate-spin" />} Reject permanently
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
        <a href={`/ops/orders/${order.publicCode}/print`} target="_blank" rel="noreferrer" className="no-print">
          <Button size="lg" variant="outline" className="h-12"><Printer className="h-4 w-4" /> Print docket</Button>
        </a>
      </div>
    </div>
  );
}
