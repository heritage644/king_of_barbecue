import { Worker, Job } from 'bullmq';
import { QUEUES, NotificationJob } from '@kob/core';
import { getEnv } from '../config/env';
import { sendEmail } from '../mailer';
import { getOutbox, markOutboxSent, claimPendings } from '../db/outbox';
import { logger } from '../logger';

async function deliverMessage(messageId: string): Promise<void> {
  const message = await getOutbox(messageId);
  if (!message) {
    logger.warn({ messageId }, 'outbox message missing');
    return;
  }
  if (message.status === 'SENT') return; // idempotent
  await sendEmail({
    to: message.recipient,
    subject: message.subject,
    body: message.body,
  });
  await markOutboxSent(message.id);
  logger.info({ messageId: message.id, type: message.type }, 'notification delivered');
}

/**
 * Notification queue: loads the outbox message, delivers via the mailer,
 * marks it SENT. Outbox + BullMQ retries give at-least-once delivery.
 */
export function createNotificationWorker(): Worker<NotificationJob> {
  return new Worker<NotificationJob>(
    QUEUES.notifications,
    async (job: Job<NotificationJob>) => {
      if (!job.data.messageId) {
        logger.warn({ jobId: job.id }, 'notification job without messageId');
        return;
      }
      await deliverMessage(job.data.messageId);
    },
    { connection: { host: new URL(getEnv().REDIS_URL).hostname, port: Number(new URL(getEnv().REDIS_URL).port || 6379) } },
  );
}

/**
 * Safety sweep: any outbox row that remained PENDING (e.g. the API was down
 * between commit and enqueue) is delivered here. Runs at startup and every
 * 60s. This is the transactional-outbox safety net.
 */
export function startOutboxSweeper(intervalMs = 60_000): NodeJS.Timeout {
  const sweep = async () => {
    try {
      const rows = await claimPendings(50);
      for (const row of rows) {
        // row attempts already incremented; treat as its own delivery
        await deliverMessage(row.id);
      }
      if (rows.length > 0) logger.info({ count: rows.length }, 'outbox sweep');
    } catch (err) {
      logger.warn({ err }, 'outbox sweep failed');
    }
  };
  void sweep();
  return setInterval(() => void sweep(), intervalMs);
}
