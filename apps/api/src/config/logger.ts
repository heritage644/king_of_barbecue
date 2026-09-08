import pino from 'pino';
import { getEnv } from './env';

/**
 * Structured logging with sensitive-field redaction. Never log passwords,
 * tokens or cookies. Future integration: pipe these JSON lines to any
 * collector (Loki, Datadog, CloudWatch) without code changes.
 */
export const logger = pino({
  level: getEnv().LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'res.headers["set-cookie"]',
      'trackingToken',
      'token',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'kob-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(name: string) {
  return logger.child({ module: name });
}
