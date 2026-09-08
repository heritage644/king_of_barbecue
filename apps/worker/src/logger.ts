import pino from 'pino';
import { getEnv } from './config/env';

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  base: { service: 'kob-worker' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: ['password', 'token', 'authorization'], censor: '[REDACTED]' },
});
