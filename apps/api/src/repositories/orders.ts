import type { PoolClient } from 'pg';
import { query, queryOne, withTransaction } from '../db';
import type {
  OrderStatus,
  PaymentStatus,
  FulfillmentMethod,
  Currency,
  ActorType,
  Role,
  RejectionReasonCode,
  FailureReasonCode,
  CancelReasonCode,
  OrderListQuery,
} from '@kob/core';

export interface OrderRow {
  id: string;
  public_code: string;
  idempotency_key: string | null;
  user_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  fulfillment_method: FulfillmentMethod;
  delivery_address: string | null;
  delivery_area: string | null;
  delivery_instructions: string | null;
  special_instructions: string | null;
  subtotal_minor: number;
  delivery_fee_minor: number;
  total_minor: number;
  currency: Currency;
  status: OrderStatus;
  payment_status: PaymentStatus;
  rejection_reason_code: RejectionReasonCode | null;
  rejection_note: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit_price_minor: number;
  quantity: number;
  instructions: string;
}

export interface HistoryRow {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: ActorType;
  actor_user_id: string | null;
  actor_role: Role | null;
  reason_code: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  method: string;
  status: PaymentStatus;
  amount_minor: number;
  currency: Currency;
  paid_at: Date | null;
  external_ref: string | null;
  created_at: Date;
  updated_at: Date;
}

const ORDER_COLUMNS = `
  id, public_code, idempotency_key, user_id, guest_name, guest_email, guest_phone,
  fulfillment_method, delivery_address, delivery_area, delivery_instructions,
  special_instructions, subtotal_minor, delivery_fee_minor, total_minor, currency,
  status, payment_status, rejection_reason_code, rejection_note, completed_at,
  created_at, updated_at
`;

export const ORDER_COLUMNS_ALIASED = ORDER_COLUMNS.trim().split(/\s+/).map((c) => `o.${c}`).join(' ');

export interface CreateOrderData {
  publicCode: string;
  idempotencyKey: string | null;
  userId: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress: string | null;
  deliveryArea: string | null;
  deliveryInstructions: string | null;
  specialInstructions: string | null;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: Currency;
  items: Array<{
    productId: string | null;
    name: string;
    unitPriceMinor: number;
    quantity: number;
    instructions: string;
  }>;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  actorType: ActorType;
  actorUserId: string | null;
  actorRole: Role | null;
}

export async function findOrderByCode(code: string): Promise<OrderRow | null> {
  return queryOne<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE public_code = $1`,
    [code.toUpperCase()],
  );
}

export async function findOrderById(id: string): Promise<OrderRow | null> {
  return queryOne<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`, [id]);
}

export async function findOrderByIdempotencyKey(key: string): Promise<OrderRow | null> {
  return queryOne<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE idempotency_key = $1`,
    [key],
  );
}

export async function listOrderItems(orderId: string): Promise<OrderItemRow[]> {
  return query<OrderItemRow>(
    `SELECT id, order_id, product_id, name, unit_price_minor, quantity, instructions
     FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId],
  );
}

export async function listOrderTimeline(orderId: string): Promise<HistoryRow[]> {
  return query<HistoryRow>(
    `SELECT id, from_status, to_status, actor_type, actor_user_id, actor_role,
            reason_code, note, metadata, created_at
     FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC, id ASC`,
    [orderId],
  );
}

export async function listPayments(orderId: string): Promise<PaymentRow[]> {
  return query<PaymentRow>(
    `SELECT id, order_id, method, status, amount_minor, currency, paid_at,
            external_ref, created_at, updated_at
     FROM payments WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId],
  );
}

export async function listOrdersForUser(
  userId: string,
  cursor: { createdAt: string; id: string } | null,
  limit: number,
): Promise<OrderRow[]> {
  const params: unknown[] = [userId];
  let cursorClause = '';
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    cursorClause = `AND (o.created_at, o.id) < ($2::timestamptz, $3::uuid)`;
  }
  params.push(limit + 1);
  return query<OrderRow>(
    `SELECT ${ORDER_COLUMNS_ALIASED}
     FROM orders o
     WHERE o.user_id = $1 ${cursorClause}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT $${params.length}`,
    params,
  );
}

function buildOpsListQuery(input: OrderListQuery): { text: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];

  if (input.q) {
    params.push(`%${input.q}%`);
    const i = params.length;
    where.push(`(o.public_code ILIKE $${i} OR o.guest_name ILIKE $${i} OR o.guest_phone ILIKE $${i} OR o.guest_email ILIKE $${i})`);
  }
  if (input.status) {
    params.push(input.status);
    where.push(`o.status = $${params.length}`);
  }
  if (input.paymentStatus) {
    params.push(input.paymentStatus);
    where.push(`o.payment_status = $${params.length}`);
  }
  if (input.fulfillmentMethod) {
    params.push(input.fulfillmentMethod);
    where.push(`o.fulfillment_method = $${params.length}`);
  }
  if (input.from || input.to) {
    const from = input.from ? new Date(input.from) : null;
    const to = input.to ? new Date(input.to) : null;
    if (!from || Number.isNaN(from.getTime())) {
      throw new Error('Invalid from date');
    }
    if (!to || Number.isNaN(to.getTime())) {
      throw new Error('Invalid to date');
    }
    params.push(from.toISOString());
    where.push(`o.created_at >= $${params.length}`);
    params.push(to.toISOString());
    where.push(`o.created_at <= $${params.length}`);
  }
  if (input.cursor) {
    const decoded = decodeCursor(input.cursor);
    if (decoded) {
      params.push(decoded.createdAt, decoded.id);
      where.push(`(o.created_at, o.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return { text: whereSql, params };
}

export type Cursor = { createdAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`).toString('base64url');
}

export function decodeCursor(cursor: string): Cursor | null {
  try {
    const [createdAt, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!createdAt || !id || rest.length > 0) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function listOrdersOps(input: OrderListQuery): Promise<{
  orders: OrderRow[];
  itemCounts: Map<string, number>;
  nextCursor: string | null;
}> {
  const { text: whereSql, params } = buildOpsListQuery(input);
  const limit = input.limit ?? 25;
  const allParams = [...params, limit + 1];
  const rows = await query<OrderRow>(
    `SELECT ${ORDER_COLUMNS_ALIASED}
     FROM orders o
     ${whereSql}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT $${allParams.length}`,
    allParams,
  );
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const ids = page.map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const countRows = await query<{ order_id: string; count: string }>(
      `SELECT order_id, sum(quantity)::text AS count FROM order_items
       WHERE order_id = ANY($1::uuid[]) GROUP BY order_id`,
      [ids],
    );
    for (const row of countRows) counts.set(row.order_id, Number(row.count));
  }
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id }) : null;
  return { orders: page, itemCounts: counts, nextCursor };
}

export interface OrderAndPaymentInput {
  status: OrderStatus;
  rejectionReasonCode?: RejectionReasonCode | null;
  rejectionNote?: string | null;
  note?: string | null;
  reasonCode?: string | null;
  actorType: ActorType;
  actorUserId: string | null;
  actorRole: Role | null;
  metadata?: Record<string, unknown>;
  completed?: boolean;
  cancelled?: boolean;
}

export async function updateOrderStatus(
  orderId: string,
  input: OrderAndPaymentInput,
): Promise<OrderRow> {
  return withTransaction(async (client) => {
    const row = await client.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS_ALIASED}
       FROM orders o WHERE o.id = $1 FOR UPDATE`,
      [orderId],
    );
    const current = row.rows[0];
    if (!current) return null as unknown as OrderRow;
    await client.query(
      `INSERT INTO order_status_history
        (order_id, from_status, to_status, actor_type, actor_user_id, actor_role,
         reason_code, note, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        orderId,
        current.status,
        input.status,
        input.actorType,
        input.actorUserId,
        input.actorRole,
        input.reasonCode ?? input.rejectionReasonCode ?? null,
        input.note ?? input.rejectionNote ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    const updated = await client.query<OrderRow>(
      `UPDATE orders SET
         status = $2,
         rejection_reason_code = COALESCE($3, rejection_reason_code),
         rejection_note = COALESCE($4, rejection_note),
         completed_at = CASE WHEN $5 THEN now() ELSE completed_at END,
         cancelled_at = CASE WHEN $6 THEN now() ELSE cancelled_at END,
         updated_at = now()
       WHERE id = $1
       RETURNING ${ORDER_COLUMNS}`,
      [
        orderId,
        input.status,
        input.reasonCode ?? null,
        input.note ?? null,
        input.completed ?? false,
        input.cancelled ?? false,
      ],
    );
    return updated.rows[0] as OrderRow;
  });
}

export interface CreateOrderResult {
  order: OrderRow;
  items: OrderItemRow[];
}

export async function createOrder(client: PoolClient, data: CreateOrderData): Promise<OrderRow> {
  const result = await client.query<OrderRow>(
    `INSERT INTO orders (
       public_code, idempotency_key, user_id, guest_name, guest_email, guest_phone,
       fulfillment_method, delivery_address, delivery_area, delivery_instructions,
       special_instructions, subtotal_minor, delivery_fee_minor, total_minor, currency,
       status, payment_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'PENDING',$16)
     RETURNING ${ORDER_COLUMNS}`,
    [
      data.publicCode,
      data.idempotencyKey,
      data.userId,
      data.guestName,
      data.guestEmail,
      data.guestPhone,
      data.fulfillmentMethod,
      data.deliveryAddress,
      data.deliveryArea,
      data.deliveryInstructions,
      data.specialInstructions,
      data.subtotalMinor,
      data.deliveryFeeMinor,
      data.totalMinor,
      data.currency,
      data.paymentStatus,
    ],
  );
  return result.rows[0] as OrderRow;
}

export async function insertOrderItems(
  client: PoolClient,
  orderId: string,
  items: CreateOrderData['items'],
): Promise<void> {
  for (const item of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, name, unit_price_minor, quantity, instructions)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [orderId, item.productId, item.name, item.unitPriceMinor, item.quantity, item.instructions],
    );
  }
}

export async function insertInitialHistory(
  client: PoolClient,
  data: CreateOrderData,
  orderId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO order_status_history
      (order_id, from_status, to_status, actor_type, actor_user_id, actor_role, metadata)
     VALUES ($1, NULL, 'PENDING', $2, $3, $4, $5)`,
    [
      orderId,
      data.actorType,
      data.actorUserId,
      data.actorRole,
      JSON.stringify({ event: 'order.created' }),
    ],
  );
}

export async function insertPayment(
  client: PoolClient,
  data: {
    orderId: string;
    method: string;
    status: PaymentStatus;
    amountMinor: number;
    currency: Currency;
  },
): Promise<PaymentRow> {
  const result = await client.query<PaymentRow>(
    `INSERT INTO payments (order_id, method, status, amount_minor, currency)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, order_id, method, status, amount_minor, currency, paid_at,
               external_ref, created_at, updated_at`,
    [data.orderId, data.method, data.status, data.amountMinor, data.currency],
  );
  return result.rows[0] as PaymentRow;
}

export async function insertPaymentHistory(
  client: PoolClient,
  paymentId: string,
  fromStatus: PaymentStatus | null,
  toStatus: PaymentStatus,
  actorType: ActorType,
  actorUserId: string | null,
  actorRole: Role | null,
  note?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO payment_status_history
      (payment_id, from_status, to_status, actor_type, actor_user_id, actor_role, note, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      paymentId,
      fromStatus,
      toStatus,
      actorType,
      actorUserId,
      actorRole,
      note ?? null,
      JSON.stringify(metadata ?? {}),
    ],
  );
}

export async function findUserOrderIds(code: string): Promise<OrderRow | null> {
  return findOrderByCode(code);
}
