/**
 * Controlled enums shared by API, worker and web.
 * Stored in PostgreSQL as TEXT with CHECK constraints (not native PG enums)
 * so future values can be added through additive migrations.
 */

export const OrderStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  IN_PREPARATION: 'IN_PREPARATION',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUSES = Object.values(OrderStatus) as OrderStatus[];

/** Statuses that still need operational attention. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.APPROVED,
  OrderStatus.IN_PREPARATION,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.REJECTED,
  OrderStatus.FAILED,
  OrderStatus.CANCELLED,
];

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CASH_ON_DELIVERY: 'CASH_ON_DELIVERY',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PAYMENT_STATUSES = Object.values(PaymentStatus) as PaymentStatus[];

export const FulfillmentMethod = {
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY',
} as const;
export type FulfillmentMethod = (typeof FulfillmentMethod)[keyof typeof FulfillmentMethod];

export const PaymentMethod = {
  MANUAL: 'MANUAL',
  CASH_ON_DELIVERY: 'CASH_ON_DELIVERY',
  GATEWAY: 'GATEWAY',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const Role = {
  CUSTOMER: 'CUSTOMER',
  CASHIER: 'CASHIER',
  OPERATIONS_STAFF: 'OPERATIONS_STAFF',
  MANAGER: 'MANAGER',
  OWNER: 'OWNER',
  SUPPLIER: 'SUPPLIER',
  INVENTORY_STAFF: 'INVENTORY_STAFF',
  KITCHEN_STAFF: 'KITCHEN_STAFF',
  LOGISTICS: 'LOGISTICS',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLES = Object.values(Role) as Role[];

export const Currency = {
  NGN: 'NGN',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const ActorType = {
  SYSTEM: 'SYSTEM',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const RejectionReasonCode = {
  ITEM_OUT_OF_STOCK: 'ITEM_OUT_OF_STOCK',
  DELIVERY_ZONE_UNAVAILABLE: 'DELIVERY_ZONE_UNAVAILABLE',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  RESTAURANT_CAPACITY: 'RESTAURANT_CAPACITY',
  OTHER: 'OTHER',
} as const;
export type RejectionReasonCode = (typeof RejectionReasonCode)[keyof typeof RejectionReasonCode];
export const REJECTION_REASON_CODES = Object.values(RejectionReasonCode) as RejectionReasonCode[];

export const FailureReasonCode = {
  CUSTOMER_UNREACHABLE: 'CUSTOMER_UNREACHABLE',
  DELIVERY_UNABLE_TO_REACH: 'DELIVERY_UNABLE_TO_REACH',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  OPERATIONAL_ISSUE: 'OPERATIONAL_ISSUE',
  RESTAURANT_ISSUE: 'RESTAURANT_ISSUE',
  OTHER: 'OTHER',
} as const;
export type FailureReasonCode = (typeof FailureReasonCode)[keyof typeof FailureReasonCode];
export const FAILURE_REASON_CODES = Object.values(FailureReasonCode) as FailureReasonCode[];

export const CancelReasonCode = {
  CUSTOMER_REQUEST: 'CUSTOMER_REQUEST',
  ITEM_OUT_OF_STOCK: 'ITEM_OUT_OF_STOCK',
  DUPLICATE_ORDER: 'DUPLICATE_ORDER',
  OPERATIONAL_ISSUE: 'OPERATIONAL_ISSUE',
  OTHER: 'OTHER',
} as const;
export type CancelReasonCode = (typeof CancelReasonCode)[keyof typeof CancelReasonCode];
export const CANCEL_REASON_CODES = Object.values(CancelReasonCode) as CancelReasonCode[];

export const StorePauseReason = {
  TEMPORARY_HOLD: 'TEMPORARY_HOLD',
  DAILY_CLOSURE: 'DAILY_CLOSURE',
  OPERATIONAL_ISSUE: 'OPERATIONAL_ISSUE',
  OTHER: 'OTHER',
} as const;
export type StorePauseReason = (typeof StorePauseReason)[keyof typeof StorePauseReason];
export const STORE_PAUSE_REASONS = Object.values(StorePauseReason) as StorePauseReason[];
