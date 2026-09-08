import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppError, PaymentStatus } from '@kob/core';
import { getEnv } from '../config/env';
import { recordWebhookEvent, markWebhookProcessed, markWebhookFailed } from '../repositories/webhookEvents';
import { applyGatewayPayment } from '../services/orderService';
import { childLogger } from '../config/logger';

const log = childLogger('webhooks');

/**
 * Payment-provider webhook (future-proofing for gateway integrations).
 *
 * Contract in Phase 1 (documented, dev tool):
 *   POST /api/webhooks/payment-provider
 *   Headers: x-kob-signature: sha256=<hmac of RAW body with PAYMENT_WEBHOOK_SECRET>
 *   Body: { eventId, orderCode, status: 'PAID'|'FAILED', externalRef, amountMinor? }
 *
 * - Authenticity is verified with a constant-time HMAC comparison.
 * - Idempotency via unique(provider, event_id) — retries are safe.
 * - Business logic lives in PaymentService/OrderService, never here.
 */
export async function paymentWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
  const signature = req.get('x-kob-signature') ?? '';
  const expected = createHmac('sha256', getEnv().PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    log.warn({ eventId: (req.body as { eventId?: string })?.eventId }, 'webhook signature mismatch');
    throw AppError.forbidden('Invalid webhook signature.');
  }

  const { eventId, orderCode, status, externalRef, amountMinor } = req.body as {
    eventId: string;
    orderCode: string;
    status: string;
    externalRef: string;
    amountMinor?: number;
  };
  if (!eventId || !orderCode || !status || !externalRef) {
    throw AppError.validation('Webhook payload is missing required fields.');
  }

  const event = await recordWebhookEvent('payment-provider', eventId, req.body as Record<string, unknown>);
  if (!event) {
    // Duplicate delivery — idempotent success.
    res.json({ received: true, duplicate: true });
    return;
  }

  try {
    const to = status === 'PAID' ? PaymentStatus.PAID : PaymentStatus.FAILED;
    await applyGatewayPayment(orderCode, to, externalRef, amountMinor);
    await markWebhookProcessed(event.id);
    res.json({ received: true, processed: true });
  } catch (err) {
    await markWebhookFailed(event.id, err instanceof Error ? err.message : 'unknown');
    // Let the provider retry.
    throw AppError.conflict(err instanceof Error ? err.message : 'Webhook processing failed.');
  }
}
