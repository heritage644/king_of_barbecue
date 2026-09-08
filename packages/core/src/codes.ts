import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

/**
 * Human-friendly order code: "ORD-" + 6 chars from an unambiguous alphabet.
 * Random, never sequential — the sequential DB id is never exposed.
 * The hash is unique-indexed in PostgreSQL; creation retries on collision.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CODE_LENGTH = 6;

export function generatePublicOrderCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const index = randomBytes(1)[0]! % CODE_ALPHABET.length;
    code += CODE_ALPHABET[index];
  }
  return `ORD-${code}`;
}

/** Generate a UUID-ish cart id (Redis key). */
export function generateCartId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Signed guest tracking token for SSE authorization.
 * token = base64url( code + '.' + hmac(code) )
 * A guest who places an order receives this token (httpOnly cookie + one-time
 * return in the response). MITM-safe hygiene requires HTTPS in production.
 */
export function signOrderTrackingToken(code: string, secret: string): string {
  const payload = code;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifyOrderTrackingToken(token: string, secret: string): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret)
    .update(Buffer.from(payload, 'base64url').toString('utf8'))
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, 'base64url').toString('utf8');
}

export function hmacEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
