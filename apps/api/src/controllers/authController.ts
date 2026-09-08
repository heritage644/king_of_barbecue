import type { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { loginUser, registerUser, getCurrentUser } from '../services/authService';
import { clearSessionCookie, setSessionCookie } from '../utils/cookies';
import { AppError } from '@kob/core';

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const input = req.body as { fullName: string; email: string; phone?: string | null; password: string; orderCode?: string | null };
  const result = await registerUser(input);
  setSessionCookie(res, result.token);
  res.status(201).json({
    user: result.user,
    linkedOrderCode: result.linkedOrderCode,
  });
}

export async function login(req: AuthRequest, res: Response): Promise<void> {
  const input = req.body as { email: string; password: string };
  const result = await loginUser(input);
  setSessionCookie(res, result.token);
  res.json({ user: result.user });
}

export async function logout(_req: AuthRequest, res: Response): Promise<void> {
  clearSessionCookie(res);
  res.json({ ok: true });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const user = await getCurrentUser(req.auth.sub);
  res.json({ user });
}
