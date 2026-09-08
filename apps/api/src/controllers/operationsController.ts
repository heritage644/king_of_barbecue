import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { AppError, PaymentStatus, OrderStatus, Role } from '@kob/core';
import { AuthRequest } from '../middleware/auth';
import {
  approveOrder,
  cancelOrder,
  failOrder,
  getOrderForViewer,
  listOrdersForOperations,
  rejectOrder,
  setPaymentStatus,
  transitionOrder,
  type StaffActor,
} from '../services/orderService';
import { getRealtimeGateway } from '../realtime/gateway';
import { openSseStream } from '../realtime/sse';
import { OrderListQuery } from '@kob/core';

function actor(req: AuthRequest): StaffActor {
  if (!req.auth) throw AppError.unauthorized();
  return { userId: req.auth.sub, role: req.auth.role as Role };
}

export async function listOrders(req: AuthRequest, res: Response): Promise<void> {
  const queryData = req.query as OrderListQuery;
  const page = await listOrdersForOperations(queryData);
  res.json(page);
}

export async function getOrder(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const order = await getOrderForViewer(code, {
    userId: req.auth?.sub ?? null,
    role: req.auth?.role ?? null,
  });
  res.json({ order });
}

export async function approve(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const startPreparing = (req.body as { startPreparing?: boolean })?.startPreparing === true;
  const order = await approveOrder(code, actor(req), startPreparing);
  res.json({ order });
}

export async function transition(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const body = req.body as { to?: string; note?: string };
  const to = body.to as OrderStatus | undefined;
  if (!to) throw AppError.validation('Missing target status.');
  const valid: OrderStatus[] = [
    OrderStatus.APPROVED,
    OrderStatus.IN_PREPARATION,
    OrderStatus.READY,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.COMPLETED,
  ];
  if (!valid.includes(to)) throw AppError.validation('Invalid target status.');
  const order = await transitionOrder(code, to, actor(req), body.note);
  res.json({ order });
}

export async function reject(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const body = req.body as { reasonCode?: string; note?: string };
  if (!body.reasonCode) throw AppError.validation('A structured rejection reason is required.');
  const order = await rejectOrder(code, { reasonCode: body.reasonCode as never, note: body.note }, actor(req));
  res.json({ order });
}

export async function fail(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const body = req.body as { reasonCode?: string; note?: string };
  if (!body.reasonCode) throw AppError.validation('A structured failure reason is required.');
  const order = await failOrder(code, { reasonCode: body.reasonCode as never, note: body.note }, actor(req));
  res.json({ order });
}

export async function cancel(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const body = req.body as { reasonCode?: string; note?: string };
  const order = await cancelOrder(
    code,
    { reasonCode: (body.reasonCode ?? 'OTHER') as never, note: body.note },
    actor(req),
  );
  res.json({ order });
}

export async function paymentStatus(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const body = req.body as { status?: string; note?: string };
  if (!body.status) throw AppError.validation('Missing payment status.');
  const valid: PaymentStatus[] = ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CASH_ON_DELIVERY'] as PaymentStatus[];
  if (!valid.includes(body.status as PaymentStatus)) throw AppError.validation('Invalid payment status.');
  const order = await setPaymentStatus(code, body.status as PaymentStatus, actor(req), body.note);
  res.json({ order });
}

/**
 * Operations realtime feed (SSE). New/updated orders and store events arrive
 * via the shared Redis pub/sub gateway — no polling, no per-request refresh.
 */
export async function streamOperations(req: AuthRequest, res: Response): Promise<void> {
  const { send } = openSseStream(req, res, () => undefined);
  const subscriber = getRealtimeGateway().subscribeOperations((event) => send(event));
  req.on('close', () => subscriber.unsubscribe());
}

export function generateEventId(): string {
  return randomUUID();
}
