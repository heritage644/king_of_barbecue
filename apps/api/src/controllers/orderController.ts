import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppError, Role, verifyOrderTrackingToken } from '@kob/core';
import { AuthRequest } from '../middleware/auth';
import { createOrder, getOrderForViewer } from '../services/orderService';
import { ensureCartId, readCartCookie, setTrackingCookie, trackingCookieName } from '../utils/cookies';
import { getEnv } from '../config/env';
import { getRealtimeGateway } from '../realtime/gateway';
import { openSseStream } from '../realtime/sse';

const OPERATIONS_ROLES: Role[] = ['CASHIER', 'OPERATIONS_STAFF', 'MANAGER', 'OWNER', 'ADMIN'];

export async function placeOrder(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    fulfillmentMethod: 'PICKUP' | 'DELIVERY';
    deliveryAddress?: string | null;
    deliveryArea?: string | null;
    deliveryInstructions?: string | null;
    specialInstructions?: string | null;
    paymentMethod?: 'MANUAL' | 'CASH_ON_DELIVERY';
  };
  const cartId = ensureCartId(req, res);
  const idempotencyKey =
    (req.get('Idempotency-Key') as string | undefined) ?? randomUUID();

  const result = await createOrder({
    checkout: {
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone,
      fulfillmentMethod: body.fulfillmentMethod,
      deliveryAddress: body.deliveryAddress,
      deliveryArea: body.deliveryArea,
      deliveryInstructions: body.deliveryInstructions,
      specialInstructions: body.specialInstructions,
      paymentMethod: body.paymentMethod ?? 'MANUAL',
    },
    cartId,
    userId: req.auth?.sub ?? null,
    idempotencyKey,
  });

  const isReplay = result.trackingToken === 'replay';
  if (!isReplay) {
    const token = signTrackingToken(result.order.publicCode);
    setTrackingCookie(res, result.order.publicCode, token);
  }
  res.status(201).json({
    order: result.order,
    trackingToken: isReplay ? null : signTrackingToken(result.order.publicCode),
  });
}

function signTrackingToken(code: string): string {
  // Imported lazily to keep controller surface small; HMAC-SHA256 token.
  const { createHmac } = require('crypto') as typeof import('crypto');
  const secret = getEnv().TRACKING_SECRET;
  const sig = createHmac('sha256', secret).update(code).digest('base64url');
  return `${Buffer.from(code).toString('base64url')}.${sig}`;
}

function readTrackingToken(req: Request, code: string): string | null {
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const cookieToken = req.cookies?.[trackingCookieName(code)] as string | undefined;
  return queryToken ?? cookieToken ?? null;
}

export async function getOrder(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const token = readTrackingToken(req, code);
  const order = await getOrderForViewer(code, {
    userId: req.auth?.sub ?? null,
    role: req.auth?.role ?? null,
    trackingToken: token ? verifyOrderTrackingToken(token, getEnv().TRACKING_SECRET) : null,
  });
  res.json({ order });
}

/**
 * SSE stream for a specific order. Authorized via:
 *  1. staff session cookie (any operations role), OR
 *  2. authenticated customer who owns the order, OR
 *  3. signed guest tracking token (cookie returned at checkout).
 */
export async function streamOrder(req: AuthRequest, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const upperCode = code.toUpperCase();
  const token = readTrackingToken(req, upperCode);
  const trackedCode = token ? verifyOrderTrackingToken(token, getEnv().TRACKING_SECRET) : null;
  const isTracked = trackedCode === upperCode;

  let allowed = isTracked;
  if (!allowed && req.auth && OPERATIONS_ROLES.includes(req.auth.role)) allowed = true;
  if (!allowed && req.auth && req.auth.role === Role.CUSTOMER) {
    const owned = await getOrderForViewer(upperCode, { userId: req.auth.sub, role: req.auth.role }).catch(
      () => null,
    );
    allowed = !!owned;
  }
  if (!allowed) throw AppError.notFound('Order not found.');

  const { send } = openSseStream(req, res, () => undefined);
  const subscriber = getRealtimeGateway().subscribeOrder(upperCode, (event) => send(event));
  req.on('close', () => subscriber.unsubscribe());
}
