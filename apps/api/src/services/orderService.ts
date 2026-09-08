import { randomUUID } from 'crypto';
import {
  AppError,
  assertValidPaymentTransition,
  assertValidTransition,
  CancelReasonCode,
  CheckoutResult,
  FailureReasonCode,
  FulfillmentMethod,
  Order,
  OrderEvent,
  OrderListQuery,
  OrderStatus,
  Page,
  PaymentStatus,
  Role,
  generatePublicOrderCode,
  computeTotals,
} from '@kob/core';
import { withTransaction, queryOne } from '../db';
import { assertCheckoutConditionalRules } from '@kob/core';
import {
  createOrder as createOrderRow,
  decodeCursor,
  findOrderByCode,
  findOrderById,
  findOrderByIdempotencyKey,
  insertInitialHistory,
  insertOrderItems,
  insertPayment,
  insertPaymentHistory,
  listOrderItems,
  listOrdersForUser,
  listOrdersOps,
  listOrderTimeline,
  listPayments,
  updateOrderStatus,
  type CreateOrderData,
  type OrderRow,
  type PaymentRow,
} from '../repositories/orders';
import { getStoreSettings } from '../repositories/storeSettings';
import { getRealtimeGateway } from '../realtime/gateway';
import { clearCart, resolveCartForCheckout } from './cartService';
import { toOrderFull, toOrderSummary } from './dto';
import { enqueueAnalytics, enqueueNotification } from '../jobs/producer';
import { insertOutbox } from '../repositories/outbox';
import { childLogger } from '../config/logger';

const log = childLogger('orders');

function isUniqueViolation(err: unknown, column?: string): boolean {
  const e = err as { code?: string; constraint?: string };
  return e?.code === '23505' && (!column || (e.constraint ?? '').includes(column));
}

export function money(minor: number): string {
  return `₦${(minor / 100).toFixed(2)}`;
}

// ---------------- Creation ----------------

export interface CreateOrderInput {
  checkout: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    fulfillmentMethod: FulfillmentMethod;
    deliveryAddress?: string | null;
    deliveryArea?: string | null;
    deliveryInstructions?: string | null;
    specialInstructions?: string | null;
    paymentMethod: 'MANUAL' | 'CASH_ON_DELIVERY';
  };
  cartId: string;
  userId?: string | null;
  idempotencyKey?: string | null;
}

export async function createOrder(input: CreateOrderInput): Promise<CheckoutResult> {
  assertCheckoutConditionalRules(input.checkout);
  if (input.idempotencyKey) {
    const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      const full = await loadFullOrder(existing.id);
      return { order: full, trackingToken: 'replay' };
    }
  }

  // Backend-authoritative pricing + availability + store-open enforcement.
  const lines = await resolveCartForCheckout(input.cartId);
  const settings = await getStoreSettings();
  if (settings.is_paused) throw AppError.storePaused();

  const isDelivery = input.checkout.fulfillmentMethod === FulfillmentMethod.DELIVERY;
  const deliveryFee = isDelivery ? settings.delivery_fee_minor : 0;
  const totals = computeTotals(
    lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      unitPriceMinor: l.product.price_minor,
      quantity: l.quantity,
      isAvailable: l.product.is_available,
    })),
    deliveryFee,
  );

  const initialPaymentStatus: PaymentStatus =
    input.checkout.paymentMethod === 'CASH_ON_DELIVERY'
      ? PaymentStatus.CASH_ON_DELIVERY
      : PaymentStatus.UNPAID;

  let result: { order: OrderRow; messageId: string } | null = null;
  for (let attempt = 0; attempt < 6 && !result; attempt += 1) {
    const publicCode = generatePublicOrderCode();
    try {
      result = await createOrderInTransaction({
        input,
        lines,
        totals,
        initialPaymentStatus,
        publicCode,
      });
    } catch (err) {
      if (isUniqueViolation(err, 'public_code')) continue;
      if (isUniqueViolation(err, 'idempotency') && input.idempotencyKey) {
        const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
        if (existing) {
          const full = await loadFullOrder(existing.id);
          return { order: full, trackingToken: 'replay' };
        }
      }
      throw err;
    }
  }
  if (!result) throw AppError.internal('Could not allocate an order code.');
  const { order: orderRow, messageId } = result;

  const full = await loadFullOrder(orderRow.id);
  await clearCart(input.cartId).catch(() => undefined);

  await enqueueNotification({ messageId }).catch((err) =>
    log.warn({ err }, 'notification enqueue failed'),
  );
  await publishOrderUpdate(full, 'order.created');
  log.info({ code: full.publicCode, totalMinor: full.totalMinor }, 'order created');
  return { order: full, trackingToken: full.publicCode };
}

async function createOrderInTransaction(params: {
  input: CreateOrderInput;
  lines: Array<{ product: { id: string; name: string; price_minor: number; is_available: boolean }; quantity: number; instructions: string }>;
  totals: { subtotalMinor: number; deliveryFeeMinor: number; totalMinor: number; currency: 'NGN' };
  initialPaymentStatus: PaymentStatus;
  publicCode: string;
}): Promise<{ order: OrderRow; messageId: string }> {
  const { input, lines, totals, initialPaymentStatus, publicCode } = params;
  const isDelivery = input.checkout.fulfillmentMethod === FulfillmentMethod.DELIVERY;

  return withTransaction(async (client) => {
    const data: CreateOrderData = {
      publicCode,
      idempotencyKey: input.idempotencyKey ?? null,
      userId: input.userId ?? null,
      guestName: input.checkout.guestName,
      guestEmail: input.checkout.guestEmail.toLowerCase(),
      guestPhone: input.checkout.guestPhone,
      fulfillmentMethod: input.checkout.fulfillmentMethod,
      deliveryAddress: isDelivery ? (input.checkout.deliveryAddress ?? null) : null,
      deliveryArea: isDelivery ? (input.checkout.deliveryArea ?? null) : null,
      deliveryInstructions: isDelivery ? (input.checkout.deliveryInstructions ?? null) : null,
      specialInstructions: input.checkout.specialInstructions || null,
      subtotalMinor: totals.subtotalMinor,
      deliveryFeeMinor: totals.deliveryFeeMinor,
      totalMinor: totals.totalMinor,
      currency: totals.currency,
      items: lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        unitPriceMinor: l.product.price_minor,
        quantity: l.quantity,
        instructions: l.instructions,
      })),
      paymentMethod: input.checkout.paymentMethod,
      paymentStatus: initialPaymentStatus,
      actorType: input.userId ? 'CUSTOMER' : 'SYSTEM',
      actorUserId: input.userId ?? null,
      actorRole: input.userId ? Role.CUSTOMER : null,
    };

    const order = await createOrderRow(client, data);
    await insertOrderItems(client, order.id, data.items);
    const payment = await insertPayment(client, {
      orderId: order.id,
      method: data.paymentMethod,
      status: initialPaymentStatus,
      amountMinor: totals.totalMinor,
      currency: totals.currency,
    });
    await insertPaymentHistory(
      client,
      payment.id,
      null,
      initialPaymentStatus,
      data.actorType,
      data.actorUserId,
      data.actorRole,
      null,
      { event: 'payment.created' },
    );
    await insertInitialHistory(client, data, order.id);

    // Transactional outbox: notification only dispatches after durability.
    const itemsSummary = data.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const messageId = await insertOutbox(
      {
        type: 'ORDER_CONFIRMATION',
        recipient: order.guest_email,
        subject: `Order ${order.public_code} received — King of Barbecue`,
        body: `Hi ${order.guest_name},\n\nWe received your order ${order.public_code}:\n${itemsSummary}\nTotal: ${money(order.total_minor)}\n\nTrack it: ${order.public_code}\n\n— King of Barbecue`,
        payload: { orderId: order.id, code: order.public_code },
      },
      client,
    );
    return { order, messageId };
  });
}

export async function loadFullOrder(orderId: string): Promise<Order> {
  const order = await findOrderById(orderId);
  if (!order) throw AppError.notFound('Order not found.');
  const [items, timeline, payments] = await Promise.all([
    listOrderItems(order.id),
    listOrderTimeline(order.id),
    listPayments(order.id),
  ]);
  return toOrderFull(order, items, timeline, payments);
}

export async function getOrderForViewer(
  code: string,
  context: {
    userId?: string | null;
    role?: Role | null;
    trackingToken?: string | null;
  },
): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  if (context.role && ['CASHIER', 'OPERATIONS_STAFF', 'MANAGER', 'OWNER', 'ADMIN'].includes(context.role)) {
    return loadFullOrder(order.id);
  }
  if (order.user_id && context.userId && order.user_id === context.userId) {
    return loadFullOrder(order.id);
  }
  // Guest access: the signed tracking token is verified upstream and resolved
  // back to the public code it was minted for. Only that exact order is shown.
  if (
    context.trackingToken &&
    context.trackingToken.toUpperCase() === code.toUpperCase()
  ) {
    return loadFullOrder(order.id);
  }
  throw AppError.notFound('Order not found.');
}

// ---------------- Listing / search ----------------

export async function listOrdersForOperations(queryData: OrderListQuery): Promise<Page<ReturnType<typeof toOrderSummary>>> {
  const { orders, itemCounts, nextCursor } = await listOrdersOps(queryData);
  return {
    items: orders.map((o) => toOrderSummary(o, itemCounts.get(o.id) ?? 0)),
    nextCursor,
    hasMore: nextCursor !== null,
  };
}

export async function listOrdersForCustomer(
  userId: string,
  cursor: string | null,
  limit: number,
): Promise<Page<Order>> {
  const decoded = cursor ? decodeCursor(cursor) : null;
  const rows = await listOrdersForUser(userId, decoded, limit);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const full: Order[] = [];
  for (const row of page) {
    const [items, payments] = await Promise.all([listOrderItems(row.id), listPayments(row.id)]);
    full.push(toOrderFull(row, items, [], payments));
  }
  const last = page[page.length - 1];
  return {
    items: full,
    nextCursor: hasMore && last
      ? Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString('base64url')
      : null,
    hasMore,
  };
}

// ---------------- Staff actions ----------------

export interface StaffActor {
  userId: string;
  role: Role;
}

export async function approveOrder(code: string, actor: StaffActor, startPreparing = false): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  await transition(order, OrderStatus.APPROVED, actor, startPreparing ? 'Approved.' : 'Order approved.');
  if (startPreparing) {
    const afterApprove = await findOrderByCode(code);
    if (afterApprove) {
      await transition(afterApprove, OrderStatus.IN_PREPARATION, actor, 'Preparation started.');
    }
  }
  return loadFullOrder(order.id);
}

export async function transitionOrder(code: string, to: OrderStatus, actor: StaffActor, note?: string): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  const updated = await transition(order, to, actor, note);
  return loadFullOrder(updated.id);
}

async function transition(order: OrderRow, to: OrderStatus, actor: StaffActor, note?: string): Promise<OrderRow> {
  assertValidTransition(order.status, to, order.fulfillment_method);
  const updated = await updateOrderStatus(order.id, {
    status: to,
    actorType: 'STAFF',
    actorUserId: actor.userId,
    actorRole: actor.role,
    note,
    metadata: { action: 'staff-transition' },
    completed: to === OrderStatus.COMPLETED,
    cancelled: to === OrderStatus.CANCELLED,
  });
  const full = await loadFullOrder(updated.id);
  await publishOrderUpdate(full, eventTypeFor(to));
  return updated;
}

function eventTypeFor(status: OrderStatus): OrderEvent['type'] {
  switch (status) {
    case OrderStatus.COMPLETED:
      return 'order.completed';
    case OrderStatus.REJECTED:
      return 'order.rejected';
    case OrderStatus.CANCELLED:
      return 'order.cancelled';
    case OrderStatus.FAILED:
      return 'order.failed';
    default:
      return 'order.updated';
  }
}

export async function rejectOrder(
  code: string,
  input: { reasonCode: RejectionReasonCodes; note?: string },
  actor: StaffActor,
): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  if (!['PENDING', 'APPROVED'].includes(order.status)) {
    throw AppError.conflict(`Cannot reject an order in ${order.status}.`);
  }
  const updated = await updateOrderStatus(order.id, {
    status: OrderStatus.REJECTED,
    reasonCode: input.reasonCode,
    note: input.note ?? null,
    actorType: 'STAFF',
    actorUserId: actor.userId,
    actorRole: actor.role,
    metadata: { action: 'reject' },
  });
  const full = await loadFullOrder(updated.id);
  await publishOrderUpdate(full, 'order.rejected');
  return full;
}

export async function failOrder(
  code: string,
  input: { reasonCode: FailureReasonCodes; note?: string },
  actor: StaffActor,
): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  assertValidTransition(order.status, OrderStatus.FAILED, order.fulfillment_method);
  const updated = await updateOrderStatus(order.id, {
    status: OrderStatus.FAILED,
    reasonCode: input.reasonCode,
    note: input.note ?? null,
    actorType: 'STAFF',
    actorUserId: actor.userId,
    actorRole: actor.role,
    metadata: { action: 'fail' },
  });
  const full = await loadFullOrder(updated.id);
  await publishOrderUpdate(full, 'order.failed');
  return full;
}

export async function cancelOrder(
  code: string,
  input: { reasonCode: CancelReasonCodes; note?: string },
  actor: StaffActor,
): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  const NOT_CANCELLABLE: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.REJECTED, OrderStatus.CANCELLED];
  if (NOT_CANCELLABLE.includes(order.status)) {
    throw AppError.conflict(`Cannot cancel an order in ${order.status}.`);
  }
  assertValidTransition(order.status, OrderStatus.CANCELLED, order.fulfillment_method);
  const updated = await updateOrderStatus(order.id, {
    status: OrderStatus.CANCELLED,
    reasonCode: input.reasonCode,
    note: input.note ?? null,
    actorType: 'STAFF',
    actorUserId: actor.userId,
    actorRole: actor.role,
    metadata: { action: 'cancel' },
    cancelled: true,
  });
  const full = await loadFullOrder(updated.id);
  await publishOrderUpdate(full, 'order.cancelled');
  return full;
}

type RejectionReasonCodes = import('@kob/core').RejectionReasonCode;
type FailureReasonCodes = import('@kob/core').FailureReasonCode;
type CancelReasonCodes = import('@kob/core').CancelReasonCode;

// ---------------- Payment ----------------

export async function setPaymentStatus(
  code: string,
  to: PaymentStatus,
  actor: StaffActor,
  note?: string,
): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  const payment = await queryOne<PaymentRow>(
    `SELECT id, order_id, method, status, amount_minor, currency, paid_at, external_ref, created_at, updated_at
     FROM payments WHERE order_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [order.id],
  );
  if (!payment) throw AppError.notFound('Payment record not found.');

  await withTransaction(async (client) => {
    const locked = await client.query<PaymentRow>(
      `SELECT id, order_id, method, status, amount_minor, currency, paid_at, external_ref, created_at, updated_at
       FROM payments WHERE id = $1 FOR UPDATE`,
      [payment.id],
    );
    const current = locked.rows[0] as PaymentRow;
    assertValidPaymentTransition(current.status, to);
    await client.query(
      `UPDATE payments SET status = $2,
         paid_at = CASE WHEN $2 IN ('PAID','REFUNDED') THEN coalesce(paid_at, now()) ELSE paid_at END,
         updated_at = now()
       WHERE id = $1`,
      [current.id, to],
    );
    await insertPaymentHistory(client, current.id, current.status, to, 'STAFF', actor.userId, actor.role, note ?? null, {
      action: 'manual',
    });
    await client.query(`UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1`, [order.id, to]);
  });

  const full = await loadFullOrder(order.id);
  await publishOrderUpdate(full, 'order.payment.updated');
  return full;
}

export async function applyGatewayPayment(
  code: string,
  to: PaymentStatus,
  externalRef: string,
  amountMinor?: number,
): Promise<Order> {
  const order = await findOrderByCode(code);
  if (!order) throw AppError.notFound('Order not found.');
  const payment = await queryOne<PaymentRow>(
    `SELECT id, order_id, method, status, amount_minor, currency, paid_at, external_ref, created_at, updated_at
     FROM payments WHERE order_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [order.id],
  );
  if (!payment) throw AppError.notFound('Payment record not found.');

  await withTransaction(async (client) => {
    const locked = await client.query<PaymentRow>(
      `SELECT id, order_id, method, status, amount_minor, currency, paid_at, external_ref, created_at, updated_at
       FROM payments WHERE id = $1 FOR UPDATE`,
      [payment.id],
    );
    const current = locked.rows[0] as PaymentRow;
    assertValidPaymentTransition(current.status, to);
    await client.query(
      `UPDATE payments SET status = $2, paid_at = CASE WHEN $2 = 'PAID' THEN now() ELSE paid_at END, external_ref = $3, updated_at = now()
       WHERE id = $1`,
      [current.id, to, externalRef],
    );
    await insertPaymentHistory(
      client,
      current.id,
      current.status,
      to,
      'SYSTEM',
      null,
      null,
      'payment provider webhook',
      { action: 'gateway', externalRef, amountMinor: amountMinor ?? null },
    );
    await client.query(`UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1`, [order.id, to]);
  });

  const full = await loadFullOrder(order.id);
  await publishOrderUpdate(full, 'order.payment.updated');
  return full;
}

// ---------------- Realtime + notifications ----------------

function orderEventFrom(full: Order, type: OrderEvent['type']): OrderEvent {
  const last = full.timeline[full.timeline.length - 1];
  return {
    eventId: randomUUID(),
    type,
    orderId: full.id,
    code: full.publicCode,
    status: full.status,
    paymentStatus: full.paymentStatus,
    fulfillmentMethod: full.fulfillmentMethod,
    customerName: full.guestName,
    itemCount: full.items.reduce((n, i) => n + i.quantity, 0),
    totalMinor: full.totalMinor,
    currency: full.currency,
    reasonCode: last?.reasonCode ?? null,
    note: last?.note ?? null,
    createdAt: full.createdAt,
    emittedAt: new Date().toISOString(),
  };
}

async function publishOrderUpdate(full: Order, type: OrderEvent['type']): Promise<void> {
  const event = orderEventFrom(full, type);
  await getRealtimeGateway()
    .publishOrderEvent(event)
    .catch((err) => log.warn({ err }, 'realtime publish failed'));
  // Non-critical side effects — never block or fail the order operation.
  void sendOrderStatusEmail(full, type);
  if (type === 'order.completed') {
    void enqueueAnalytics({
      type: 'order.completed',
      orderId: full.id,
      code: full.publicCode,
      createdAt: full.createdAt,
    }).catch((err) => log.warn({ err }, 'analytics enqueue failed'));
  }
}

export async function sendOrderStatusEmail(order: Order, type: string): Promise<void> {
  try {
    const messageId = await insertOutbox({
      type: `ORDER_${type.toUpperCase()}`,
      recipient: order.guestEmail,
      subject: `Order ${order.publicCode} ${type.toLowerCase()} — King of Barbecue`,
      body: `Hi ${order.guestName},\n\nYour order ${order.publicCode} is now: ${order.status}.\n\n— King of Barbecue`,
      payload: { orderId: order.id, code: order.publicCode, status: order.status },
    });
    await enqueueNotification({ messageId }).catch((err) => log.warn({ err }, 'notify enqueue failed'));
  } catch (err) {
    // Never fail an order operation because a notification failed.
    log.warn({ err }, 'status email failed');
  }
}
