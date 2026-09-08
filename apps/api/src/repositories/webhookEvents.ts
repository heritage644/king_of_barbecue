import { query, queryOne, withTransaction } from '../db';

export interface WebhookEventRow {
  id: string;
  provider: string;
  event_id: string;
  payload: Record<string, unknown>;
  status: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED';
  error: string | null;
  created_at: Date;
  processed_at: Date | null;
}

/**
 * Idempotent webhook recording: unique(provider, event_id) makes retries a
 * no-op. Returns the row when this event is NEW, null when already seen.
 */
export async function recordWebhookEvent(
  provider: string,
  eventId: string,
  payload: Record<string, unknown>,
): Promise<WebhookEventRow | null> {
  try {
    const row = await queryOne<WebhookEventRow>(
      `INSERT INTO webhook_events (provider, event_id, payload, status)
       VALUES ($1,$2,$3,'RECEIVED')
       RETURNING id, provider, event_id, payload, status, error, created_at, processed_at`,
      [provider, eventId, JSON.stringify(payload)],
    );
    return row;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return null; // duplicate
    throw err;
  }
}

export async function markWebhookProcessed(id: string): Promise<void> {
  await query(
    `UPDATE webhook_events SET status = 'PROCESSED', processed_at = now(), error = NULL WHERE id = $1`,
    [id],
  );
}

export async function markWebhookFailed(id: string, error: string): Promise<void> {
  await query(`UPDATE webhook_events SET status = 'FAILED', error = $2 WHERE id = $1`, [id, error]);
}

export async function withWebhookTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(fn);
}
