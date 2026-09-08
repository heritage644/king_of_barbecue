import {
  OrderStatus,
  FulfillmentMethod,
  PaymentStatus,
} from './constants';
import { AppError } from './errors';

/**
 * Order state machine (Phase 1).
 *
 * Canonical happy path:
 *   PENDING -> APPROVED -> IN_PREPARATION -> READY -> OUT_FOR_DELIVERY -> COMPLETED
 *   (PICKUP orders skip OUT_FOR_DELIVERY: READY -> COMPLETED)
 *
 * Failure/terminal paths:
 *   PENDING -> REJECTED | CANCELLED | FAILED
 *   APPROVED -> CANCELLED | FAILED
 *   IN_PREPARATION -> CANCELLED | FAILED
 *   READY -> CANCELLED | FAILED
 *   OUT_FOR_DELIVERY -> FAILED
 *
 * All other transitions are rejected. The operations portal also offers a
 * convenience "approve & start" action that performs the two transitions
 * PENDING -> APPROVED -> IN_PREPARATION atomically, recording BOTH history
 * entries — it never bypasses the machine.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.APPROVED, OrderStatus.REJECTED, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.APPROVED]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.IN_PREPARATION]: [OrderStatus.READY, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.FAILED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.COMPLETED, OrderStatus.FAILED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.CANCELLED]: [],
};

export interface TransitionRule {
  next: OrderStatus;
  /** Extra predicate constraints (e.g. delivery-only transitions). */
  assert?: (ctx: { fulfillmentMethod: FulfillmentMethod }) => boolean;
}

export function allowedTransitions(
  from: OrderStatus,
  fulfillmentMethod?: FulfillmentMethod,
): OrderStatus[] {
  return ORDER_TRANSITIONS[from].filter((next) => {
    if (
      next === OrderStatus.OUT_FOR_DELIVERY &&
      fulfillmentMethod === FulfillmentMethod.PICKUP
    ) {
      return false;
    }
    if (
      next === OrderStatus.COMPLETED &&
      fulfillmentMethod === FulfillmentMethod.DELIVERY &&
      from === OrderStatus.READY
    ) {
      // A delivery order must go OUT_FOR_DELIVERY before COMPLETED.
      return false;
    }
    return true;
  });
}

export function assertValidTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentMethod?: FulfillmentMethod,
): void {
  if (to === from) {
    throw AppError.conflict(`Order is already ${to}.`);
  }
  const allowed = allowedTransitions(from, fulfillmentMethod);
  if (!allowed.includes(to)) {
    throw AppError.conflict(
      `Invalid order status transition: ${from} -> ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}.`,
    );
  }
}

/**
 * Payment state machine. Deliberately decoupled from order status:
 * a PICKUP order can be APPROVED while payment is still UNPAID (cash at
 * counter), and a gateway payment can be PAID while the kitchen is still
 * preparing. Webhook-driven updates must go through this same machine.
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.UNPAID]: [PaymentStatus.PENDING, PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CASH_ON_DELIVERY],
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED],
  [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
  [PaymentStatus.FAILED]: [PaymentStatus.PENDING, PaymentStatus.PAID],
  [PaymentStatus.CASH_ON_DELIVERY]: [PaymentStatus.PAID, PaymentStatus.REFUNDED],
  [PaymentStatus.REFUNDED]: [],
};

export function assertValidPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (to === from) {
    throw AppError.conflict(`Payment is already ${to}.`);
  }
  const allowed = PAYMENT_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw AppError.conflict(
      `Invalid payment status transition: ${from} -> ${to}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}.`,
    );
  }
}
