import { queryOne, withTransaction } from '../db';
import type { ActorType, Role } from '@kob/core';

export interface StoreSettingsRow {
  id: number;
  is_paused: boolean;
  paused_at: Date | null;
  paused_by_user_id: string | null;
  pause_reason: string | null;
  pause_note: string | null;
  restaurant_name: string;
  phone: string | null;
  address: string | null;
  opening_hours: Record<string, string>;
  socials: Record<string, string>;
  delivery_fee_minor: number;
  config: Record<string, unknown>;
  updated_at: Date;
}

export async function getStoreSettings(): Promise<StoreSettingsRow> {
  const row = await queryOne<StoreSettingsRow>('SELECT * FROM store_settings WHERE id = 1');
  if (!row) throw new Error('store_settings row missing — run migrations + seed');
  return row;
}

export async function setPaused(
  paused: boolean,
  actorUserId: string | null,
  actorRole: Role | null,
  reason: string | null,
  note: string | null,
): Promise<StoreSettingsRow> {
  return withTransaction(async (client) => {
    const result = await client.query<StoreSettingsRow>(
      `UPDATE store_settings SET
         is_paused = $1::boolean,
         paused_at = CASE WHEN $1 THEN now() ELSE NULL END,
         paused_by_user_id = CASE WHEN $1::boolean THEN $2::uuid ELSE NULL END,
         pause_reason = CASE WHEN $1::boolean THEN $3::text ELSE NULL END,
         pause_note = CASE WHEN $1::boolean THEN $4::text ELSE NULL END,
         updated_at = now()
       WHERE id = 1
       RETURNING *`,
      [paused, actorUserId ?? null, reason ?? null, note ?? null],
    );
    return result.rows[0] as StoreSettingsRow;
  });
}

export async function lastPausedByRole(): Promise<Role | null> {
  const row = await queryOne<{ role: Role | null }>(
    `SELECT u.role FROM store_settings s LEFT JOIN users u ON u.id = s.paused_by_user_id WHERE s.id = 1`,
  );
  return row?.role ?? null;
}

export type { ActorType };
