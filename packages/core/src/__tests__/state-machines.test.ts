import { describe, it, expect } from 'vitest';
import {
  assertValidTransition,
  assertValidPaymentTransition,
  allowedTransitions,
  OrderStatus,
  PaymentStatus,
  FulfillmentMethod,
} from '../index';

describe('order state machine', () => {
  it('allows the canonical happy path', () => {
    expect(() => assertValidTransition(OrderStatus.PENDING, OrderStatus.APPROVED)).not.toThrow();
    expect(() => assertValidTransition(OrderStatus.APPROVED, OrderStatus.IN_PREPARATION)).not.toThrow();
    expect(() => assertValidTransition(OrderStatus.IN_PREPARATION, OrderStatus.READY)).not.toThrow();
    expect(() =>
      assertValidTransition(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, FulfillmentMethod.DELIVERY),
    ).not.toThrow();
    expect(() =>
      assertValidTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED, FulfillmentMethod.DELIVERY),
    ).not.toThrow();
  });

  it('pickup orders skip out-for-delivery', () => {
    const allowed = allowedTransitions(OrderStatus.READY, FulfillmentMethod.PICKUP);
    expect(allowed).toContain(OrderStatus.COMPLETED);
    expect(allowed).not.toContain(OrderStatus.OUT_FOR_DELIVERY);
  });

  it('delivery orders cannot jump ready -> completed', () => {
    expect(() =>
      assertValidTransition(OrderStatus.READY, OrderStatus.COMPLETED, FulfillmentMethod.DELIVERY),
    ).toThrow();
    expect(() =>
      assertValidTransition(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY, FulfillmentMethod.DELIVERY),
    ).not.toThrow();
  });

  it('allows terminal paths with reasons', () => {
    expect(() => assertValidTransition(OrderStatus.PENDING, OrderStatus.REJECTED)).not.toThrow();
    expect(() => assertValidTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).not.toThrow();
    expect(() => assertValidTransition(OrderStatus.IN_PREPARATION, OrderStatus.FAILED)).not.toThrow();
  });

  it('rejects invalid/arbitrary transitions', () => {
    expect(() => assertValidTransition(OrderStatus.PENDING, OrderStatus.READY)).toThrow();
    expect(() => assertValidTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toThrow();
    expect(() => assertValidTransition(OrderStatus.APPROVED, OrderStatus.REJECTED)).toThrow();
    expect(() => assertValidTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toThrow();
    expect(() => assertValidTransition(OrderStatus.REJECTED, OrderStatus.PENDING)).toThrow();
  });

  it('terminal states allow no transitions', () => {
    for (const terminal of [OrderStatus.COMPLETED, OrderStatus.REJECTED, OrderStatus.FAILED, OrderStatus.CANCELLED]) {
      expect(allowedTransitions(terminal)).toEqual([]);
    }
  });
});

describe('payment state machine', () => {
  it('supports manual verification and COD', () => {
    expect(() => assertValidPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.PAID)).not.toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.CASH_ON_DELIVERY)).not.toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.CASH_ON_DELIVERY, PaymentStatus.PAID)).not.toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.PAID, PaymentStatus.REFUNDED)).not.toThrow();
  });

  it('rejects impossible payment transitions', () => {
    expect(() => assertValidPaymentTransition(PaymentStatus.UNPAID, PaymentStatus.REFUNDED)).toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.PAID, PaymentStatus.FAILED)).toThrow();
    expect(() => assertValidPaymentTransition(PaymentStatus.REFUNDED, PaymentStatus.PAID)).toThrow();
  });
});
