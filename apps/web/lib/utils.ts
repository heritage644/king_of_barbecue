import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  OrderStatus,
  PaymentStatus,
  FulfillmentMethod,
  type Order,
  type OrderSummary,
} from '@kob/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(minor: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface StatusMeta {
  label: string;
  /** Tailwind classes for the badge */
  badge: string;
  dot: string;
  description: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  [OrderStatus.PENDING]: { label: 'Order Received', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', description: 'We received your order and are reviewing it.' },
  [OrderStatus.APPROVED]: { label: 'Approved', badge: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500', description: 'Your order has been confirmed.' },
  [OrderStatus.IN_PREPARATION]: { label: 'In Preparation', badge: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500', description: 'The kitchen is preparing your order.' },
  [OrderStatus.READY]: { label: 'Ready', badge: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-500', description: 'Your order is ready.' },
  [OrderStatus.OUT_FOR_DELIVERY]: { label: 'Out for Delivery', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500', description: 'Your order is on its way.' },
  [OrderStatus.COMPLETED]: { label: 'Completed', badge: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500', description: 'Enjoy your meal! Thanks for ordering.' },
  [OrderStatus.REJECTED]: { label: 'Rejected', badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500', description: 'We could not fulfil this order.' },
  [OrderStatus.FAILED]: { label: 'Failed', badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500', description: 'This order could not be completed.' },
  [OrderStatus.CANCELLED]: { label: 'Cancelled', badge: 'bg-neutral-200 text-neutral-700 border-neutral-300', dot: 'bg-neutral-500', description: 'This order was cancelled.' },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, StatusMeta> = {
  [PaymentStatus.UNPAID]: { label: 'Unpaid', badge: 'bg-neutral-100 text-neutral-700 border-neutral-300', dot: 'bg-neutral-400', description: '' },
  [PaymentStatus.PENDING]: { label: 'Payment Pending', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', description: '' },
  [PaymentStatus.PAID]: { label: 'Paid', badge: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500', description: '' },
  [PaymentStatus.FAILED]: { label: 'Payment Failed', badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500', description: '' },
  [PaymentStatus.REFUNDED]: { label: 'Refunded', badge: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500', description: '' },
  [PaymentStatus.CASH_ON_DELIVERY]: { label: 'Cash on Delivery', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500', description: '' },
};

export const REASON_LABELS: Record<string, string> = {
  ITEM_OUT_OF_STOCK: 'Item out of stock',
  DELIVERY_ZONE_UNAVAILABLE: 'Delivery zone unavailable',
  SUSPICIOUS_ACTIVITY: 'Suspicious activity',
  RESTAURANT_CAPACITY: 'Restaurant capacity',
  CUSTOMER_UNREACHABLE: 'Customer unreachable',
  DELIVERY_UNABLE_TO_REACH: 'Driver unable to reach customer',
  PAYMENT_FAILED: 'Payment failed',
  OPERATIONAL_ISSUE: 'Operational issue',
  RESTAURANT_ISSUE: 'Restaurant issue',
  CUSTOMER_REQUEST: 'Customer request',
  DUPLICATE_ORDER: 'Duplicate order',
  OTHER: 'Other',
};

export function fulfillmentLabel(method: FulfillmentMethod): string {
  return method === FulfillmentMethod.DELIVERY ? 'Delivery' : 'Pickup';
}

export function orderSubtotal(order: Order | OrderSummary): number {
  const items = 'items' in order && order.items ? order.items : [];
  return items.reduce((n, i) => n + i.unitPriceMinor * i.quantity, 0);
}

export function shortCode(code: string): string {
  return code.replace(/^ORD-/, '');
}
