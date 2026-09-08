import { query, queryOne } from '../db';

export interface OutboxRow {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  next_retry_at: Date;
  last_error: string | null;
  created_at: Date;
  processed_at: Date | null;
}

export async function insertOutbox(
  input: {
    id?: string;
    type: string;
    recipient: string;
    subject: string;
    body: string;
    payload?: Record<string, unknown>;
  },
  client?: import('pg').PoolClient,
): Promise<string> {
  const sql = `INSERT INTO outbox_messages (type, recipient, subject, body, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`;
  const params = [input.type, input.recipient, input.subject, input.body, JSON.stringify(input.payload ?? {})];
  if (client) {
    const result = await client.query<{ id: string }>(sql, params);
    const row = result.rows[0];
    if (!row) throw new Error('outbox insert failed');
    return row.id;
  }
  const row = await queryOne<{ id: string }>(sql, params);
  if (!row) throw new Error('outbox insert failed');
  return row.id;
}

export async function claimPendings(limit = 10): Promise<OutboxRow[]> {
  // Simple claim: pick PENDING rows due now. Worker processes can overlap in
  // multi-worker deploys; use `FOR UPDATE SKIP LOCKED` for correctness.
  return query<OutboxRow>(
    `WITH cte AS (
       SELECT id FROM outbox_messages
       WHERE status = 'PENDING' AND next_retry_at <= now()
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE outbox_messages m SET attempts = m.attempts + 1
     FROM cte WHERE m.id = cte.id
     RETURNING m.*`,
    [limit],
  );
}

export async function markOutboxSent(id: string): Promise<void> {
  await query(
    `UPDATE outbox_messages SET status = 'SENT', processed_at = now(), last_error = NULL WHERE id = $1`,
    [id],
  );
}

export async function markOutboxFailed(id: string, error: string, nextRetryAt: Date): Promise<void> {
  await query(
    `UPDATE outbox_messages SET status = 'FAILED', last_error = $2, next_retry_at = $3 WHERE id = $1`,
    [id, error, nextRetryAt.toISOString()],
  );
}

export async function getOutbox(id: string): Promise<OutboxRow | null> {
  return queryOne<OutboxRow>('SELECT * FROM outbox_messages WHERE id = $1', [id]);
}
