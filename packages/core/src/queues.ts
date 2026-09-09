import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * BullMQ queue plan (Phase 1).
 *
 * requests never wait for these jobs; they are enqueued after the DB
 * transaction commits. Job failures are retried by BullMQ and surfaced in
 * structured logs / outbox state.
 */
export const QUEUES = {
  notifications: 'notifications',
  guestAccountLinking: 'guest-account-linking',
  analytics: 'analytics',
  
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface NotificationJob {
  messageId: string;
}

export interface GuestLinkingJob {
  userId: string;
  email: string;
}

export interface AnalyticsJob {
  type: 'order.completed';
  orderId: string;
  code: string;
  createdAt: string;
}

export interface QueueBundle {
  notifications: Queue<NotificationJob>;
  guestAccountLinking: Queue<GuestLinkingJob>;
  analytics: Queue<AnalyticsJob>;
}

/**
 * Create shared Queue handles. Both the API (producer) and the worker
 * (consumer) create their own Queue/Worker instances pointing at the same
 * Redis — that is the BullMQ model.
 */
export function createQueues(redisUrl: string): QueueBundle {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });
  // BullMQ recommends maxRetriesPerRequest: null; use a single connection
  // per queue here — each Queue creates its own command connection.
  const notifications = new Queue<NotificationJob>(QUEUES.notifications, {
    connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false }),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
  });
  const guestAccountLinking = new Queue<GuestLinkingJob>(QUEUES.guestAccountLinking, {
    connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false }),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
  });
  const analytics = new Queue<AnalyticsJob>(QUEUES.analytics, {
    connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false }),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
  });
  void connection;
  return { notifications, guestAccountLinking, analytics };
}
