'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderEvent, StoreEvent, RealtimeEvent } from '@kob/core';

/**
 * SSE hooks. All streams go through the Next.js rewrite (`/api/...`),
 * authenticated with httpOnly cookies. `NextEventSource` reconnects
 * automatically; we dedupe alert-worthy events on the client by eventId.
 */

export function useOrderStream(code: string, token: string | null, onEvent: (e: OrderEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    const es = new EventSource(`/api/orders/${encodeURIComponent(code)}/stream?${params.toString()}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const handle = (raw: MessageEvent) => {
      try {
        const event = JSON.parse(raw.data) as OrderEvent;
        handlerRef.current(event);
      } catch {
        // ignore malformed frame
      }
    };
    es.addEventListener('order-created', handle);
    es.addEventListener('order-updated', handle);
    es.addEventListener('order-payment-updated', handle);
    es.addEventListener('order-completed', handle);
    es.addEventListener('order-rejected', handle);
    es.addEventListener('order-cancelled', handle);
    es.addEventListener('order-failed', handle);
    return () => es.close();
  }, [code, token]);

  return { connected };
}

export interface OpsStreamEvent {
  event: OrderEvent | StoreEvent;
  isNewOrder: boolean;
}

export function useOpsStream(onEvent: (e: OpsStreamEvent) => void, enabled = true) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const [connected, setConnected] = useState(false);
  const seenEventIds = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource('/api/operations/orders/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handle = (raw: MessageEvent) => {
      try {
        const id = raw.lastEventId || '';
        if (id && seenEventIds.current.has(id)) return; // no duplicate alerts
        if (id) {
          seenEventIds.current.add(id);
          if (seenEventIds.current.size > 500) {
            seenEventIds.current.clear();
          }
        }
        const event = JSON.parse(raw.data) as OrderEvent | StoreEvent;
        handlerRef.current({ event, isNewOrder: event.type === 'order.created' });
      } catch {
        // ignore malformed
      }
    };
    es.addEventListener('order-created', handle);
    es.addEventListener('order-updated', handle);
    es.addEventListener('order-payment-updated', handle);
    es.addEventListener('order-completed', handle);
    es.addEventListener('order-rejected', handle);
    es.addEventListener('order-cancelled', handle);
    es.addEventListener('order-failed', handle);
    es.addEventListener('store-updated', handle);
    return () => es.close();
  }, [enabled]);

  return { connected };
}

export function useStoreStatusLive() {
  const [isPaused, setIsPaused] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/operations/orders/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
    };
    const handle = (raw: MessageEvent) => {
      try {
        const event = JSON.parse(raw.data) as RealtimeEvent;
        if (event.type === 'store.updated') {
          setIsPaused((event as StoreEvent).isPaused);
        }
      } catch {
        // ignore
      }
    };
    es.addEventListener('store-updated', handle);
    return () => es.close();
  }, []);

  return { isPaused, connected };
}

/** Elapsed-seconds ticker for order cards. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // storage unavailable
      }
    },
    [key],
  );
  return [value, set];
}

/** Web Audio two-tone chime (no asset). Enabled/muted by user preference. */
export function playOrderChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [880, 1174.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.4);
    });
  } catch {
    // audio blocked — silent
  }
}
