import { Redis } from 'ioredis';
import { getEnv } from './env';
import { childLogger } from './logger';

const log = childLogger('redis');

let client: Redis | null = null;

/** Shared Redis client for carts, cache and pub/sub. */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    client.on('error', (err) => {
      log.error({ err: err.message }, 'redis error');
    });
  }
  return client;
}

export async function pingRedis(): Promise<boolean> {
  try {
    await getRedis().ping();
    return true;
  } catch {
    return false;
  }
}
