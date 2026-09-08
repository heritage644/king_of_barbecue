import { createApp, gracefulShutdown } from './app';
import { getEnv } from './config/env';
import { logger } from './config/logger';
import { getRealtimeGateway } from './realtime/gateway';

async function main(): Promise<void> {
  const env = getEnv();
  const app = createApp();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'kob-api listening');
  });

  await getRealtimeGateway().start();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await gracefulShutdown();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start API');
  process.exit(1);
});
