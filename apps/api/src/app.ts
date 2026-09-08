import 'express-async-errors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import { corsOriginList, getEnv } from './config/env';
import { logger } from './config/logger';
import { optionalAuth } from './middleware/auth';
import { originCheck } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { getPool } from './db';

export function createApp(): Express {
  const env = getEnv();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: corsOriginList(env),
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(
    express.json({
      limit: '256kb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use('/api', originCheck, optionalAuth);

  // In-memory limiter is per-process (documented; multi-instance deployments
  // should swap to a Redis-store limiter — the store is already available).
  const generalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
  });
  const authLimiter = rateLimit({
    windowMs: 5 * 60_000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
  });
  const checkoutLimiter = rateLimit({
    windowMs: 5 * 60_000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many orders. Please try again later.' } },
  });

  app.use('/api', generalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/orders', checkoutLimiter);

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export async function gracefulShutdown(): Promise<void> {
  const { closeQueues } = await import('./jobs/producer');
  const { getRealtimeGateway } = await import('./realtime/gateway');
  const { getRedis } = await import('./config/redis');
  await Promise.allSettled([
    closeQueues(),
    getRealtimeGateway().close(),
    getRedis().quit(),
    getPool().end(),
  ]);
}
