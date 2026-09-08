'use client';

import { useEffect, useState } from 'react';
import { AlarmClockOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

/**
 * Store-wide pause banner. Polls lightweight status (5s Redis-cached on the
 * API); order creation is independently blocked server-side, this is purely
 * a customer-facing surface. Changes are also pushed live for ops staff.
 */
export function StoreStatusBanner() {
  const [paused, setPaused] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const store = await apiClient.getStoreStatus();
        if (active) setPaused(store.isPaused);
      } catch {
        // keep last known state
      }
    };
    void check();
    const id = setInterval(check, 20_000);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!paused) return null;
  return (
    <div className="bg-charcoal px-4 py-3 text-center" role="status" aria-live="polite">
      <p className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-sm font-medium text-amber-300">
        <AlarmClockOff className="h-4 w-4" />
        Services are temporarily on hold. Please check back shortly.
      </p>
    </div>
  );
}
