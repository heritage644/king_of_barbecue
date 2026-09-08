/**
 * Server-side API helper for Server Components / Route Handlers.
 * Deliberately NOT marked 'use client' — modules with that directive are
 * sandboxed client references and their functions cannot be invoked during
 * server rendering (they threw and pages silently fell back to empty states).
 */
import { ApiError } from './errors';

export async function serverFetch<T>(path: string, cookies?: string, init?: RequestInit): Promise<T> {
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookies ? { cookie: cookies } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string } } = {};
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, payload.error?.code ?? 'INTERNAL_ERROR', payload.error?.message ?? 'Something went wrong.');
  }
  return (await res.json()) as T;
}
