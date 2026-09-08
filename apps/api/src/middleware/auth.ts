import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@kob/core';
import { AppError } from '@kob/core';
import { getEnv } from '../config/env';
import { verifyAccessToken, type AuthClaims } from '../utils/jwt';

export interface AuthRequest extends Request {
  auth?: AuthClaims;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookieName = getEnv().JWT_COOKIE_NAME;
  const cookie = req.cookies?.[cookieName];
  if (typeof cookie === 'string' && cookie.length > 0) return cookie;
  return null;
}

/** Attach claims when a valid token is present; never rejects. */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const claims = verifyAccessToken(token);
    if (claims) req.auth = claims;
  }
  next();
}

/** Require a valid authenticated user. */
export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims) {
    next(AppError.unauthorized());
    return;
  }
  req.auth = claims;
  next();
}

/** Require one of the given roles. */
export function requireRole(roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    const claims = req.auth;
    if (!claims) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(claims.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
