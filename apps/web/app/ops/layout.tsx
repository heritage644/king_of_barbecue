'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Flame, LayoutDashboard, LogOut, Volume2, VolumeX } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { canAccessOperations } from '@kob/core';
import type { StoreStatus } from '@kob/core';
import { OpsPauseControl } from '@/components/ops-pause-control';
import { useLocalStorage, useStoreStatusLive } from '@/lib/hooks';

/**
 * Operations shell: client-side role guard (backend enforces every API call
 * regardless), header with master pause control, sound preference toggle.
 */
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [initialStore, setInitialStore] = useState<StoreStatus | null>(null);
  const [soundOn, setSoundOn] = useLocalStorage('kob_sound', true);
  const { isPaused } = useStoreStatusLive();

  useEffect(() => {
    (async () => {
      try {
        const { user } = await apiClient.me();
        if (!canAccessOperations(user.role)) {
          setUnauthorized(true);
          return;
        }
        const store = await apiClient.getStoreStatus();
        setInitialStore(store);
        setReady(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/ops/login');
        } else {
          setUnauthorized(true);
        }
      }
    })();
  }, [router]);

  if (pathname === '/ops/login') return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-charcoal text-neutral-400">
        Checking access…
      </div>
    );
  }
  if (unauthorized || !initialStore) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-charcoal text-neutral-300">
        <Flame className="h-8 w-8 text-brand-light" />
        <p className="font-semibold">No staff access.</p>
        <Link className="text-brand-light underline" href="/ops/login">Sign in as staff</Link>
      </div>
    );
  }

  const effectiveStore = isPaused === null ? initialStore : { ...initialStore, isPaused };

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-charcoal text-brand-light">
              <Flame className="h-4 w-4" />
            </span>
            <span className="font-bold">Operations</span>
            <span className="hidden rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 sm:inline">
              King of Barbecue
            </span>
            {effectiveStore.isPaused && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">STORE PAUSED</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/ops" className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium hover:bg-neutral-100 ${pathname === '/ops' ? 'bg-neutral-100 text-brand' : 'text-neutral-600'}`}>
              <LayoutDashboard className="h-4 w-4" /> Board
            </Link>
            <button
              onClick={() => setSoundOn(!soundOn)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              aria-label={soundOn ? 'Mute new-order alerts' : 'Enable new-order alerts'}
              title={soundOn ? 'Sound on' : 'Sound off'}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <OpsPauseControl initial={effectiveStore} />
            <button
              onClick={async () => {
                await apiClient.logout().catch(() => undefined);
                router.replace('/ops/login');
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
