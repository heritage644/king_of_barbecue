'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn, formatMoney } from '@/lib/utils';
import type { Cart } from '@kob/core';

function useCartMutation(onDone?: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, success, run };
}

export function AddToCartForm({
  productId,
  compact = false,
}: {
  productId: string;
  compact?: boolean;
}) {
  const [qty, setQty] = useState(1);
  const [instructions, setInstructions] = useState('');
  const { busy, error, success, run } = useCartMutation();

  return (
    <div className={cn(compact ? 'mt-3' : 'mt-6 space-y-4')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-neutral-300">
          <button
            type="button"
            aria-label="Decrease quantity"
            className="flex h-10 w-10 items-center justify-center text-neutral-500 hover:bg-neutral-50"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            className="flex h-10 w-10 items-center justify-center text-neutral-500 hover:bg-neutral-50"
            onClick={() => setQty((q) => Math.min(50, q + 1))}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => run(() => apiClient.addCartItem(productId, qty, instructions))}
          disabled={busy}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white',
            success ? 'bg-green-600' : 'bg-brand hover:bg-brand-dark',
            busy && 'opacity-60',
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
          {success ? 'Added to cart' : 'Add to cart'}
        </button>
      </div>
      {!compact && (
        <div>
          <label htmlFor="instructions" className="mb-1 block text-sm font-medium">Special instructions (optional)</label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={300}
            placeholder="e.g. No pepper, extra sauce"
            className="min-h-[70px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
      )}
      {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function CartLineControls({
  cart,
  productId,
  initialQty,
  initialInstructions,
}: {
  cart: Cart;
  productId: string;
  initialQty: number;
  initialInstructions: string;
}) {
  const [qty, setQty] = useState(initialQty);
  const [instructions, setInstructions] = useState(initialInstructions);
  const { busy, error, run } = useCartMutation();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-neutral-300">
          <button
            type="button"
            aria-label="Decrease quantity"
            className="flex h-8 w-8 items-center justify-center text-neutral-500 hover:bg-neutral-50"
            onClick={() => {
              const next = Math.max(1, qty - 1);
              setQty(next);
              void run(() => apiClient.updateCartItem(productId, next, instructions));
            }}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            className="flex h-8 w-8 items-center justify-center text-neutral-500 hover:bg-neutral-50"
            onClick={() => {
              const next = Math.min(50, qty + 1);
              setQty(next);
              void run(() => apiClient.updateCartItem(productId, next, instructions));
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          aria-label="Remove item"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
          onClick={() => run(() => apiClient.removeCartItem(productId))}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <input
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        onBlur={() => {
          if (instructions !== initialInstructions) {
            void run(() => apiClient.updateCartItem(productId, qty, instructions));
          }
        }}
        maxLength={300}
        placeholder="Instructions (optional)"
        className="h-9 w-full rounded-lg border border-neutral-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/50"
        aria-label="Special instructions"
      />
      {error && <p className="text-xs font-medium text-red-600" role="alert">{error}</p>}
      <p className="sr-only">{cart.itemCount}</p>
    </div>
  );
}
