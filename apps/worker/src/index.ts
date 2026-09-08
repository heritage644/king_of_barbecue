import { createNotificationWorker, startOutboxSweeper } from './jobs/notifications';
import { createGuestLinkingWorker, closeGuestLinking } from './jobs/guestLinking';
import { createAnalyticsWorker } from './jobs/analytics';
import { close } from './db/outbox';
import { logger } from './logger';

/**
 * BullMQ worker process. Runs independently of the API so long-running and
 * non-critical work (email, guest linking, analytics) never blocks requests.
 * Scale by running more instances; Redis is shared.
 */
const workers = [
  createNotificationWorker(),
  createGuestLinkingWorker(),
  createAnalyticsWorker(),
];

logger.info({ queues: workers.map((w) => w.name) }, 'kob-worker started');
const outboxSweeper = startOutboxSweeper();

for (const worker of workers) {
  worker.on('failed', (job, err) => {
    logger.error({ queue: worker.name, jobId: job?.id, err: err.message }, 'job failed');
  });
  worker.on('completed', (job) => {
    logger.debug({ queue: worker.name, jobId: job.id }, 'job completed');
  });
}

async function shutdown(): Promise<void> {
  logger.info('worker shutting down');
  clearInterval(outboxSweeper);
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled([closeGuestLinking(), close()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
