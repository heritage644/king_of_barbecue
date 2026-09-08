import type { OrderStatus, PaymentStatus, FulfillmentMethod } from './constants';

/**
 * Realtime event contract.
 *
 * The backend publishes domain events through a `RealtimeGateway` abstraction.
 * Phase 1 ships a gateway backed by Redis pub/sub (multi-instance safe) with a
 * local fallback. SSE connections are registered per-instance; publishing goes
 * through Redis so every instance fans out to its own subscribers. Swapping
 * transports later (e.g. Streams, WebSocket) only replaces this adapter.
 */

export type OrderEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.payment.updated'
  | 'order.completed'
  | 'order.rejected'
  | 'order.cancelled'
  | 'order.failed';

export type StoreEventType = 'store.updated';

export interface OrderEvent {
  eventId: string;
  type: OrderEventType;
  orderId: string;
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentMethod: FulfillmentMethod;
  merchantName?: string;
  customerName?: string;
  itemCount?: number;
  totalMinor?: number;
  currency?: string;
  reasonCode?: string | null;
  note?: string | null;
  createdAt: string;
  emittedAt: string;
}

export interface StoreEvent {
  eventId: string;
  type: StoreEventType;
  isPaused: boolean;
  pausedAt?: string | null;
  emittedAt: string;
}

export type RealtimeEvent = OrderEvent | StoreEvent;

export interface RealtimeSubscriber {
  unsubscribe: () => void;
}

export interface RealtimeGateway {
  publishOrderEvent(event: OrderEvent): Promise<void>;
  publishStoreEvent(event: StoreEvent): Promise<void>;
  subscribeOrder(code: string, handler: (event: OrderEvent) => void): RealtimeSubscriber;
  subscribeOperations(handler: (event: RealtimeEvent) => void): RealtimeSubscriber;
  close(): Promise<void>;
}

export function orderTopic(code: string): string {
  return `orders:${code}`;
}

export const OPERATIONS_TOPIC = 'operations';
export const REDIS_EVENT_CHANNEL = 'kob:events';
export const REDIS_STORE_CHANNEL = 'kob:store';

export type RealtimeTransport =
  | 'redis'
  | 'memory';
