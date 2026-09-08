import { randomUUID } from 'crypto';
import { AppError, Role, PublicUser } from '@kob/core';
import { createUser, findUserByEmail, findUserById, updateLastLogin } from '../repositories/users';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, type AuthClaims } from '../utils/jwt';
import { childLogger } from '../config/logger';
import { enqueueGuestLinking } from '../jobs/producer';

const log = childLogger('auth');

export interface RegisterInput {
  fullName: string;
  email: string;
  phone?: string | null;
  password: string;
  orderCode?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

function toPublicUser(user: {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at.toISOString(),
  };
}

export async function registerUser(input: RegisterInput): Promise<{
  user: PublicUser;
  token: string;
  linkedOrderCode: string | null;
}> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict('An account with this email already exists. Try logging in.');
  }
  const hash = hashPassword(input.password);
  const row = await createUser({
    email: input.email.toLowerCase(),
    fullName: input.fullName,
    phone: input.phone ?? null,
    passwordHash: hash,
    role: Role.CUSTOMER,
  });

  const claims: AuthClaims = {
    sub: row.id,
    email: row.email,
    name: row.full_name,
    phone: row.phone,
    role: row.role,
  };
  const token = signAccessToken(claims);

  // Current guest order linking (cheap, exact) + async historical linking.
  let linkedOrderCode: string | null = null;
  if (input.orderCode) {
    linkedOrderCode = await linkOrderToUser(row.id, row.email, input.orderCode);
  }
  await enqueueGuestLinking({ userId: row.id, email: row.email }).catch((err) => {
    log.warn({ err }, 'failed to enqueue guest linking job');
  });
  log.info({ userId: row.id, role: row.role }, 'user registered');
  return { user: toPublicUser(row), token, linkedOrderCode };
}

export async function loginUser(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
  const row = await findUserByEmail(input.email.toLowerCase());
  if (!row || !verifyPassword(input.password, row.password_hash)) {
    throw AppError.unauthorized('Invalid email or password.');
  }
  if (!row.is_active) {
    throw AppError.forbidden('This account has been deactivated.');
  }
  await updateLastLogin(row.id);
  const claims: AuthClaims = {
    sub: row.id,
    email: row.email,
    name: row.full_name,
    phone: row.phone,
    role: row.role,
  };
  const token = signAccessToken(claims);
  log.info({ userId: row.id, role: row.role }, 'user logged in');
  return { user: toPublicUser(row), token };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const row = await findUserById(userId);
  if (!row || !row.is_active) throw AppError.unauthorized('Account not found.');
  return toPublicUser(row);
}

/**
 * Link a specific guest order to a freshly created account.
 * Only links when the guest email matches AND the order is still unlinked —
 * an exact, conservative match (no phone matching heuristics for now).
 */
export async function linkOrderToUser(
  userId: string,
  email: string,
  orderCode: string,
): Promise<string | null> {
  const { query } = await import('../db');
  const result = await query<{ public_code: string }>(
    `UPDATE orders
     SET user_id = $1, updated_at = now()
     WHERE public_code = $2
       AND user_id IS NULL
       AND lower(guest_email) = lower($3)
     RETURNING public_code`,
    [userId, orderCode.toUpperCase(), email.toLowerCase()],
  );
  return result[0]?.public_code ?? null;
}

export { randomUUID };
