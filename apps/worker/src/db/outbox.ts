import { Pool } from 'pg';
import { getEnv } from '../config/env';

let pool: Pool | null = null;
function db() {
  if (!pool) pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 5 });
  return pool;
}

export interface OutboxRow {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SENT' | 'FAILED';
}

export async function getOutbox(id: string): Promise<OutboxRow | null> {
  const res = await db().query<OutboxRow>('SELECT * FROM outbox_messages WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function markOutboxSent(id: string): Promise<void> {
  await db().query(
    `UPDATE outbox_messages SET status = 'SENT', processed_at = now(), last_error = NULL WHERE id = $1`,
    [id],
  );
}

export async function claimPendings(limit = 50): Promise<OutboxRow[]> {
  const res = await db().query<OutboxRow>(
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
  return res.rows;
}

export async function close(): Promise<void> {
  await pool?.end().catch(() => undefined);
  pool = null;
}
