import type {
  OrderStatus,
  PaymentStatus,
  FulfillmentMethod,
  PaymentMethod,
  Role,
  Currency,
  ActorType,
  RejectionReasonCode,
  FailureReasonCode,
  CancelReasonCode,
} from './constants';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  categorySlug?: string;
  categoryName?: string;
  name: string;
  slug: string;
  description: string | null;
  priceMinor: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  instructions: string;
}

export interface CartLine {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  quantity: number;
  instructions: string;
  lineTotalMinor: number;
  isAvailable: boolean;
}

export interface Cart {
  cartId: string;
  lines: CartLine[];
  subtotalMinor: number;
  itemCount: number;
  currency: Currency;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  instructions: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: ActorType;
  actorUserId: string | null;
  actorRole: Role | null;
  reasonCode: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountMinor: number;
  currency: Currency;
  paidAt: string | null;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  publicCode: string;
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
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  timeline: OrderStatusHistoryEntry[];
  payment: Payment | null;
}

export interface OrderSummary {
  id: string;
  publicCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentMethod: FulfillmentMethod;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  itemCount: number;
  totalMinor: number;
  currency: Currency;
  rejectionReasonCode: RejectionReasonCode | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
  elapsedSeconds: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface StoreStatus {
  isPaused: boolean;
  pausedAt: string | null;
  pausedByUserId: string | null;
  pauseReason: string | null;
  restaurantName: string;
  phone: string | null;
  address: string | null;
  openingHours: Record<string, string> | null;
  deliveryFeeMinor: number;
  slaWarningMinutes: number;
  slaCriticalMinutes: number;
  updatedAt: string;
}

export interface CheckoutResult {
  order: Order;
  trackingToken: string;
}

export interface OrderListQuery {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentMethod?: FulfillmentMethod;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface CustomerOrderListQuery {
  cursor?: string;
  limit?: number;
}

export interface RejectionInput {
  reasonCode: RejectionReasonCode;
  note?: string;
}

export interface FailureInput {
  reasonCode: FailureReasonCode;
  note?: string;
}

export interface CancelInput {
  reasonCode: CancelReasonCode;
  note?: string;
}

export interface OperationActionInput {
  action: 'approve' | 'approve-and-start' | 'start' | 'ready' | 'out-for-delivery' | 'complete';
}
