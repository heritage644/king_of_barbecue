import jwt from 'jsonwebtoken';
import type { Role } from '@kob/core';
import { getEnv } from '../config/env';

export interface AuthClaims {
  sub: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
}

export function signAccessToken(claims: AuthClaims): string {
  const env = getEnv();
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AuthClaims | null {
  const env = getEnv();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AuthClaims;
    if (!decoded.sub || !decoded.role) return null;
    return decoded;
  } catch {
    return null;
  }
}
