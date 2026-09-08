import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@kob/core';
import { childLogger } from '../config/logger';

const log = childLogger('http-errors');

export interface ErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Centralized error handler: consistent envelope, no stack traces in
 * responses, structured logs for 5xx.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    const payload: ErrorPayload = {
      error: { code: err.code, message: err.message },
    };
    if (err.details !== undefined) payload.error.details = err.details;
    res.status(err.status).json(payload);
    return;
  }

  // Postgres unique violations → 409 with safe message.
  const pgErr = err as { code?: string; constraint?: string; message?: string };
  if (pgErr?.code === '23505') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A conflicting record already exists.' },
    });
    return;
  }
  if (pgErr?.code === '23503') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'This resource is referenced by other records.' },
    });
    return;
  }

  log.error(
    { err, method: req.method, path: req.path },
    'unhandled error',
  );
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
  });
}
