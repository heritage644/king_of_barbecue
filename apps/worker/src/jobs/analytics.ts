import { Worker, Job } from 'bullmq';
import { QUEUES, AnalyticsJob } from '@kob/core';
import { getEnv } from '../config/env';
import { logger } from '../logger';

/**
 * Analytics queue — the extension point for future statistical/AI insights.
 *
 * Phase 1: the queue exists so order lifecycle code already emits the right
 * events (no code churn later), and the processor records the event. Future
 * phases add:
 *  - daily/hourly rollups into aggregate tables (orders per hour, AOV)
 *  - demand forecasting / low-stock prediction jobs
 *  - peak-period detection
 * All inputs are the append-only history this platform already preserves.
 * The ordering system never depends on this job.
 */
export function createAnalyticsWorker(): Worker<AnalyticsJob> {
  return new Worker<AnalyticsJob>(
    QUEUES.analytics,
    async (job: Job<AnalyticsJob>) => {
      logger.info({ job: job.data }, 'analytics event received (aggregator not yet implemented)');
    },
    { connection: { host: new URL(getEnv().REDIS_URL).hostname, port: Number(new URL(getEnv().REDIS_URL).port || 6379) } },
  );
}
