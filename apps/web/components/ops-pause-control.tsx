'use client';

import { useState } from 'react';
import { AlarmClockOff, Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { StoreStatus } from '@kob/core';

/**
 * Master pause toggle for operations staff. Persists server-side,
 * clears the Redis cache, and publishes a store.updated event that flows to
 * customer storefronts (banner) + this portal via the realtime gateway.
 */
export function OpsPauseControl({ initial }: { initial: StoreStatus }) {
  const [store, setStore] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const next = await (store.isPaused
        ? apiClient.resumeStore()
        : apiClient.pauseStore('OPERATIONAL_ISSUE', 'Paused from operations portal'));
      setStore(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change store state.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void toggle()}
        disabled={busy}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition',
          store.isPaused
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-red-600 text-white hover:bg-red-700',
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlarmClockOff className="h-4 w-4" />}
        {store.isPaused ? 'Store is paused — Resume' : 'Pause Store'}
      </button>
      {error && <p className="text-xs font-medium text-red-500" role="alert">{error}</p>}
    </div>
  );
}
