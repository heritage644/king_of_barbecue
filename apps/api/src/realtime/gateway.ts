import { Redis } from 'ioredis';
import {
  OPERATIONS_TOPIC,
  OrderEvent,
  REDIS_EVENT_CHANNEL,
  REDIS_STORE_CHANNEL,
  RealtimeGateway,
  RealtimeSubscriber,
  StoreEvent,
} from '@kob/core';
import { getRedis } from '../config/redis';
import { childLogger } from '../config/logger';

const log = childLogger('realtime');

type OrderHandler = (event: OrderEvent) => void;
type OpsHandler = (event: OrderEvent | StoreEvent) => void;

interface WireMessage {
  kind: 'order' | 'store';
  event: OrderEvent | StoreEvent;
}

/**
 * Realtime gateway (phase 1):
 *  - Every API instance listens on a single Redis pub/sub channel.
 *  - `publish` sends to Redis, so ALL instances learn about the event and
 *    fan it out to their locally-connected SSE clients. This is what makes
 *    the connection layer horizontally scalable while SSE itself stays
 *    per-instance (clients are pinned to a load balancer).
 *  - Swapping to Redis Streams / WebSocket later only replaces this class.
 */
export class RedisRealtimeGateway implements RealtimeGateway {
  private readonly subscribeClient: Redis;
  private readonly publishClient: Redis;
  private readonly orderHandlers = new Map<string, Set<OrderHandler>>();
  private readonly opsHandlers = new Set<OpsHandler>();
  private started = false;

  constructor() {
    this.subscribeClient = getRedis().duplicate();
    this.publishClient = getRedis().duplicate();
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.subscribeClient.subscribe(REDIS_EVENT_CHANNEL, REDIS_STORE_CHANNEL);
    this.subscribeClient.on('message', (channel, message) => {
      try {
        const wire = JSON.parse(message) as WireMessage;
        if (channel === REDIS_EVENT_CHANNEL && wire.kind === 'order') {
          const event = wire.event as OrderEvent;
          this.dispatchOrder(event);
        } else if (channel === REDIS_STORE_CHANNEL && wire.kind === 'store') {
          const event = wire.event as StoreEvent;
          this.dispatchOps(event);
        }
      } catch (err) {
        log.warn({ err }, 'failed to parse realtime message');
      }
    });
  }

  async publishOrderEvent(event: OrderEvent): Promise<void> {
    await this.start();
    const message = JSON.stringify({ kind: 'order', event } satisfies WireMessage);
    await this.publishClient.publish(REDIS_EVENT_CHANNEL, message);
  }

  async publishStoreEvent(event: StoreEvent): Promise<void> {
    await this.start();
    const message = JSON.stringify({ kind: 'store', event } satisfies WireMessage);
    await this.publishClient.publish(REDIS_STORE_CHANNEL, message);
  }

  subscribeOrder(code: string, handler: OrderHandler): RealtimeSubscriber {
    const key = code.toUpperCase();
    let set = this.orderHandlers.get(key);
    if (!set) {
      set = new Set();
      this.orderHandlers.set(key, set);
    }
    set.add(handler);
    return { unsubscribe: () => set?.delete(handler) };
  }

  subscribeOperations(handler: OpsHandler): RealtimeSubscriber {
    this.opsHandlers.add(handler);
    return { unsubscribe: () => this.opsHandlers.delete(handler) };
  }

  private dispatchOrder(event: OrderEvent): void {
    const handlers = this.orderHandlers.get(event.code.toUpperCase());
    if (handlers) for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        log.warn({ err }, 'order subscriber failed');
      }
    }
    this.dispatchOps(event);
  }

  private dispatchOps(event: OrderEvent | StoreEvent): void {
    for (const handler of this.opsHandlers) {
      try {
        handler(event);
      } catch (err) {
        log.warn({ err }, 'ops subscriber failed');
      }
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.subscribeClient.quit(), this.publishClient.quit()]);
  }
}

let gateway: RedisRealtimeGateway | null = null;

export function getRealtimeGateway(): RedisRealtimeGateway {
  if (!gateway) gateway = new RedisRealtimeGateway();
  return gateway;
}

export function resetRealtimeGatewayForTests(): void {
  gateway = null;
}

export { OPERATIONS_TOPIC };
