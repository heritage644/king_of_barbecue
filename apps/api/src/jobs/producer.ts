import { createQueues, GuestLinkingJob, NotificationJob, AnalyticsJob } from '@kob/core';
import { getEnv } from '../config/env';

/**
 * Job producer. Separate from worker processes (see apps/worker). Every
 * enqueue is best-effort — if Redis/worker is briefly unavailable the
 * request still succeeds; jobs retry inside BullMQ.
 */
let queues: ReturnType<typeof createQueues> | null = null;

function getQueues() {
  if (!queues) queues = createQueues(getEnv().REDIS_URL);
  return queues;
}

export async function enqueueNotification(job: NotificationJob): Promise<void> {
  await getQueues().notifications.add('send', job);
}

export async function enqueueGuestLinking(job: GuestLinkingJob): Promise<void> {
  await getQueues().guestAccountLinking.add('link', job);
}

export async function enqueueAnalytics(job: AnalyticsJob): Promise<void> {
  await getQueues().analytics.add('aggregate', job);
}

export async function closeQueues(): Promise<void> {
  if (!queues) return;
  await Promise.allSettled([
    queues.notifications.close(),
    queues.guestAccountLinking.close(),
    queues.analytics.close(),
  ]);
  queues = null;
}
