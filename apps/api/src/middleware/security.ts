import type { NextFunction, Request, Response } from 'express';
import { corsOriginList, getEnv } from '../config/env';

/**
 * CSRF defense layer for cookie-authenticated state-changing requests:
 * SameSite=Lax cookies plus a strict Origin/Referer check. Requests without
 * an Origin (curl, server-to-server) are allowed — they carry no ambient
 * browser credentials. Requests with a foreign origin are rejected even
 * when the cookie would be sent.
 */
export function originCheck(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const source = origin ?? referer;
  if (!source) {
    next();
    return;
  }
  const allowed = corsOriginList(getEnv());
  try {
    const url = new URL(source);
    if (allowed.includes(url.origin)) {
      next();
      return;
    }
  } catch {
    // fall through to reject
  }
  res.status(403).json({
    error: { code: 'FORBIDDEN', message: 'Request origin is not allowed.' },
  });
}
