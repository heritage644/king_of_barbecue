import type { Order, OrderSummary, PaymentMethod } from '@kob/core';
import type {
  HistoryRow,
  OrderItemRow,
  OrderRow,
  PaymentRow,
} from '../repositories/orders';

export function toOrderItem(row: OrderItemRow) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    unitPriceMinor: row.unit_price_minor,
    quantity: row.quantity,
    instructions: row.instructions,
  };
}

export function toTimeline(row: HistoryRow) {
  return {
    id: String(row.id),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorType: row.actor_type,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    reasonCode: row.reason_code,
    note: row.note,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  };
}

export function toPayment(row: PaymentRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    method: row.method as PaymentMethod,
    status: row.status,
    amountMinor: row.amount_minor,
    currency: row.currency,
    paidAt: row.paid_at?.toISOString() ?? null,
    externalRef: row.external_ref,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toOrderFull(
  order: OrderRow,
  items: OrderItemRow[],
  timeline: HistoryRow[],
  payments: PaymentRow[],
): Order {
  return {
    id: order.id,
    publicCode: order.public_code,
    userId: order.user_id,
    guestName: order.guest_name,
    guestEmail: order.guest_email,
    guestPhone: order.guest_phone,
    fulfillmentMethod: order.fulfillment_method,
    deliveryAddress: order.delivery_address,
    deliveryArea: order.delivery_area,
    deliveryInstructions: order.delivery_instructions,
    specialInstructions: order.special_instructions,
    subtotalMinor: order.subtotal_minor,
    deliveryFeeMinor: order.delivery_fee_minor,
    totalMinor: order.total_minor,
    currency: order.currency,
    status: order.status,
    paymentStatus: order.payment_status,
    createdAt: order.created_at.toISOString(),
    updatedAt: order.updated_at.toISOString(),
    items: items.map(toOrderItem),
    timeline: timeline.map(toTimeline),
    payment: payments[0] ? toPayment(payments[0]) : null,
  };
}

export function toOrderSummary(
  order: OrderRow,
  itemCount: number,
): OrderSummary {
  return {
    id: order.id,
    publicCode: order.public_code,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillmentMethod: order.fulfillment_method,
    guestName: order.guest_name,
    guestEmail: order.guest_email,
    guestPhone: order.guest_phone,
    itemCount,
    totalMinor: order.total_minor,
    currency: order.currency,
    rejectionReasonCode: order.rejection_reason_code,
    rejectionNote: order.rejection_note,
    createdAt: order.created_at.toISOString(),
    updatedAt: order.updated_at.toISOString(),
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - order.created_at.getTime()) / 1000)),
  };
}
