import type { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getStoreStatus, setStorePaused } from '../services/storeService';
import { AppError } from '@kob/core';

export async function getStatus(_req: AuthRequest, res: Response): Promise<void> {
  const status = await getStoreStatus();
  res.json({ store: status });
}

export async function pause(req: AuthRequest, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const body = (req.body ?? {}) as { reason?: string; note?: string | null };
  const status = await setStorePaused(
    true,
    { userId: req.auth.sub, role: req.auth.role },
    body.reason ?? null,
    body.note ?? null,
  );
  res.json({ store: status });
}

export async function resume(req: AuthRequest, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const status = await setStorePaused(false, { userId: req.auth.sub, role: req.auth.role });
  res.json({ store: status });
}
