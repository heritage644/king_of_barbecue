import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Password hashing with Node's built-in scrypt (no native build deps).
 * Format: scrypt$N$r$p$saltB64$hashB64
 * N=16384, r=8, p=1, keylen=64 — OWASP-acceptable interactive parameters.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const MAX_MEM = 64 * 1024 * 1024;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAX_MEM });
  return [
    'scrypt',
    String(N),
    String(R),
    String(P),
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!n || !r || !p) return false;
  try {
    const salt = Buffer.from(saltB64!, 'base64');
    const expected = Buffer.from(hashB64!, 'base64');
    const actual = scryptSync(password, salt, expected.length, { N: n, r, p, maxmem: MAX_MEM });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
