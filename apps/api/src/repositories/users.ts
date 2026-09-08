import { query, queryOne } from '../db';
import type { Role } from '@kob/core';

export interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string | null;
  passwordHash: string;
  role: Role;
}

const SELECT_COLUMNS = `
  id, email, phone, full_name, password_hash, role, is_active, last_login_at, created_at, updated_at
`;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const row = await queryOne<UserRow>(
    `SELECT ${SELECT_COLUMNS} FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return row;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const row = await queryOne<UserRow>(
    `INSERT INTO users (email, phone, full_name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLUMNS}`,
    [input.email, input.phone ?? null, input.fullName, input.passwordHash, input.role],
  );
  if (!row) throw new Error('createUser returned no row');
  return row;
}

export async function updateLastLogin(id: string): Promise<void> {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

export async function countUsers(): Promise<number> {
  const row = await queryOne<{ count: string }>('SELECT count(*)::text AS count FROM users');
  return Number(row?.count ?? 0);
}
