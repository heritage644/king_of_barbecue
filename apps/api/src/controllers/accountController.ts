import type { Response } from 'express';
import { AppError } from '@kob/core';
import { AuthRequest } from '../middleware/auth';
import { listOrdersForCustomer } from '../services/orderService';

export async function listCustomerOrders(req: AuthRequest, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const page = await listOrdersForCustomer(
    req.auth.sub,
    cursor ?? null,
    Math.min(Number(limit ?? 20) || 20, 100),
  );
  res.json(page);
}

export async function getCustomerOrder(req: AuthRequest, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const { code } = req.params as { code: string };
  const { getOrderForViewer } = await import('../services/orderService');
  const order = await getOrderForViewer(code, { userId: req.auth.sub, role: req.auth.role });
  res.json({ order });
}
