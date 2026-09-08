import { Currency, FulfillmentMethod, PaymentMethod } from './constants';

/**
 * All monetary values in the system are stored as integer minor units
 * (kobo for NGN) to avoid floating-point errors. The UI formats them.
 */
export const MINOR_UNIT_DIVISOR = 100;
export const DEFAULT_DELIVERY_FEE_MINOR = 0;
export const MAX_ITEM_QUANTITY = 50;
export const MAX_CART_ITEMS = 100;

export interface PricedCartLine {
  productId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  isAvailable: boolean;
}

export interface Totals {
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: Currency;
  itemCount: number;
}

/**
 * Backend-only pricing. Never trust prices sent from the frontend:
 * the checkout flow re-loads products from PostgreSQL and computes
 * totals here.
 */
export function computeTotals(
  lines: PricedCartLine[],
  deliveryFeeMinor: number,
): Totals {
  const subtotalMinor = lines.reduce(
    (sum, line) => sum + line.unitPriceMinor * line.quantity,
    0,
  );
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  return {
    subtotalMinor,
    deliveryFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor,
    currency: Currency.NGN,
    itemCount,
  };
}

export interface OrderSnapshot {
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  deliveryFeeMinor: number;
  subtotalMinor: number;
  totalMinor: number;
  currency: Currency;
}

export function formatMoney(minor: number, currency: Currency = Currency.NGN): string {
  const value = minor / MINOR_UNIT_DIVISOR;
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
  return formatted;
}
