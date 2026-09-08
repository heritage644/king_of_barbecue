import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import { QUEUES, GuestLinkingJob } from '@kob/core';
import { getEnv } from '../config/env';
import { logger } from '../logger';

let pool: Pool | null = null;
function db() {
  if (!pool) pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 5 });
  return pool;
}

/**
 * Asynchronous guest-to-user order linking.
 *
 * Runs AFTER account creation — the user never waits for historical orders
 * to be searched. Matching is deliberately conservative: exact (case-
 * insensitive) email equality AND order still unlinked. A future email-
 * verification step strengthens this further; phone matching is avoided
 * because guests may omit phones on old orders.
 */
export function createGuestLinkingWorker(): Worker<GuestLinkingJob> {
  return new Worker<GuestLinkingJob>(
    QUEUES.guestAccountLinking,
    async (job: Job<GuestLinkingJob>) => {
      const { userId, email } = job.data;
      const result = await db().query(
        `UPDATE orders SET user_id = $1, updated_at = now()
         WHERE user_id IS NULL AND lower(guest_email) = lower($2)
         RETURNING public_code`,
        [userId, email.toLowerCase()],
      );
      logger.info(
        { userId, email, linked: result.rowCount },
        'guest order linking complete',
      );
    },
    { connection: { host: new URL(getEnv().REDIS_URL).hostname, port: Number(new URL(getEnv().REDIS_URL).port || 6379) } },
  );
}

export async function closeGuestLinking(): Promise<void> {
  await pool?.end().catch(() => undefined);
  pool = null;
}
