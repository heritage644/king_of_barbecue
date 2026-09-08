import type { Response } from 'express';
import { getEnv } from '../config/env';

const CART_COOKIE = 'kob_cart';
const TRACKING_COOKIE_PREFIX = 'kob_track_';

function baseOptions() {
  return {
    httpOnly: true,
    secure: getEnv().COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(getEnv().JWT_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(getEnv().JWT_COOKIE_NAME, baseOptions());
}

/** Guest cart id — non-sensitive identifier, httpOnly (documented in README). */
export function setCartCookie(res: Response, cartId: string): void {
  res.cookie(CART_COOKIE, cartId, {
    ...baseOptions(),
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

export function readCartCookie(req: { cookies?: Record<string, string | undefined> }): string | null {
  const value = req.cookies?.[CART_COOKIE];
  return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

export function ensureCartId(req: { cookies?: Record<string, string | undefined> }, res: Response): string {
  const existing = readCartCookie(req);
  if (existing) return existing;
  const { randomBytes } = require('crypto') as typeof import('crypto');
  const id = randomBytes(16).toString('hex');
  setCartCookie(res, id);
  return id;
}

export function trackingCookieName(code: string): string {
  return `${TRACKING_COOKIE_PREFIX}${code.toLowerCase()}`;
}

export function setTrackingCookie(res: Response, code: string, token: string): void {
  res.cookie(trackingCookieName(code), token, {
    ...baseOptions(),
    maxAge: 24 * 3600 * 1000,
  });
}
