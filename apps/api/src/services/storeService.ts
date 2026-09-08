import { AppError, StoreStatus } from '@kob/core';
import { getRedis } from '../config/redis';
import { getStoreSettings, setPaused } from '../repositories/storeSettings';
import { getRealtimeGateway } from '../realtime/gateway';
import { childLogger } from '../config/logger';

const log = childLogger('store');
const STATUS_CACHE_KEY = 'kob:store:status';
const STATUS_CACHE_TTL = 5; // seconds

const DEFAULT_OPENING_HOURS: Record<string, string> = {
  Monday: '10:00 – 22:00',
  Tuesday: '10:00 – 22:00',
  Wednesday: '10:00 – 22:00',
  Thursday: '10:00 – 22:00',
  Friday: '10:00 – 23:00',
  Saturday: '10:00 – 23:00',
  Sunday: '12:00 – 21:00',
};

function toStoreStatus(row: {
  is_paused: boolean;
  paused_at: Date | null;
  paused_by_user_id: string | null;
  pause_reason: string | null;
  restaurant_name: string;
  phone: string | null;
  address: string | null;
  opening_hours: Record<string, string>;
  delivery_fee_minor: number;
  config: Record<string, unknown>;
  updated_at: Date;
}): StoreStatus {
  const config = row.config ?? {};
  return {
    isPaused: row.is_paused,
    pausedAt: row.paused_at?.toISOString() ?? null,
    pausedByUserId: row.paused_by_user_id,
    pauseReason: row.pause_reason,
    restaurantName: row.restaurant_name,
    phone: row.phone,
    address: row.address,
    openingHours: row.opening_hours ?? DEFAULT_OPENING_HOURS,
    deliveryFeeMinor: row.delivery_fee_minor,
    slaWarningMinutes: Number(config.slaWarningMinutes ?? 10),
    slaCriticalMinutes: Number(config.slaCriticalMinutes ?? 20),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Store status is cached in Redis for 5s (landing pages hit this a lot).
 * Order creation reads PostgreSQL directly — the cache must never gate a
 * write that the business requires to be authoritative.
 */
export async function getStoreStatus(refresh = false): Promise<StoreStatus> {
  try {
    if (!refresh) {
      const cached = await getRedis().get(STATUS_CACHE_KEY);
      if (cached) return JSON.parse(cached) as StoreStatus;
    }
  } catch (err) {
    log.warn({ err }, 'store status cache read failed; falling back to DB');
  }
  const row = await getStoreSettings();
  const status = toStoreStatus(row);
  try {
    await getRedis().set(STATUS_CACHE_KEY, JSON.stringify(status), 'EX', STATUS_CACHE_TTL);
  } catch (err) {
    log.warn({ err }, 'store status cache write failed');
  }
  return status;
}

export async function assertStoreOpen(): Promise<void> {
  // Authoritative DB read — never cached for checkout enforcement.
  const row = await getStoreSettings();
  if (row.is_paused) {
    throw AppError.storePaused();
  }
}

export async function setStorePaused(
  paused: boolean,
  actor: { userId: string; role: string },
  reason?: string | null,
  note?: string | null,
): Promise<StoreStatus> {
  const row = await setPaused(
    paused,
    actor.userId,
    actor.role as never,
    paused ? (reason ?? 'TEMPORARY_HOLD') : null,
    paused ? (note ?? null) : null,
  );
  const status = toStoreStatus(row);
  try {
    await getRedis().del(STATUS_CACHE_KEY);
  } catch {
    // cache will expire naturally
  }
  await getRealtimeGateway()
    .publishStoreEvent({
      eventId: crypto.randomUUID(),
      type: 'store.updated',
      isPaused: status.isPaused,
      pausedAt: status.pausedAt,
      emittedAt: new Date().toISOString(),
    })
    .catch((err) => log.warn({ err }, 'store event publish failed'));
  log.info({ isPaused: paused, actor: actor.userId, reason }, 'store state changed');
  return status;
}
