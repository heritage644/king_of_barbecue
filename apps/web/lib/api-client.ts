'use client';

import type {
  Cart,
  CheckoutResult,
  Order,
  OrderSummary,
  Page,
  Product,
  ProductCategory,
  PublicUser,
  StoreStatus,
  OrderStatus,
  PaymentStatus,
} from '@kob/core';

import { ApiError } from './errors';

export { ApiError };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      res.status,
      payload.error?.code ?? 'INTERNAL_ERROR',
      payload.error?.message ?? 'Something went wrong.',
      payload.error?.details,
    );
  }
  return (await res.json()) as T;
}

export const apiClient = {
  getCategories: () => request<{ categories: ProductCategory[] }>('/categories').then((r) => r.categories),
  getProducts: () => request<{ products: Product[] }>('/products').then((r) => r.products),
  getFeatured: () => request<{ products: Product[] }>('/products/featured').then((r) => r.products),
  getProduct: (slug: string) => request<{ product: Product }>(`/products/${slug}`).then((r) => r.product),
  getStoreStatus: () => request<{ store: StoreStatus }>('/store/status').then((r) => r.store),
  getCart: () => request<{ cart: Cart }>('/cart').then((r) => r.cart),
  addCartItem: (productId: string, quantity: number, instructions: string = '') =>
    request<{ cart: Cart }>('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity, instructions }) }).then((r) => r.cart),
  updateCartItem: (productId: string, quantity: number, instructions?: string) =>
    request<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity, instructions }) }).then((r) => r.cart),
  removeCartItem: (productId: string) =>
    request<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'DELETE' }).then((r) => r.cart),
  clearCart: () => request<{ cart: Cart }>('/cart', { method: 'DELETE' }).then((r) => r.cart),

  register: (body: { fullName: string; email: string; phone?: string | null; password: string; orderCode?: string | null }) =>
    request<{ user: PublicUser; linkedOrderCode: string | null }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: PublicUser }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: PublicUser }>('/auth/me'),

  placeOrder: (body: Record<string, unknown>, idempotencyKey: string) =>
    request<CheckoutResult>('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  getOrder: (code: string) => request<{ order: Order }>(`/orders/${code}`).then((r) => r.order),
  listMyOrders: (cursor?: string) =>
    request<Page<Order>>(`/account/orders${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  listOpsOrders: (query: string) =>
    request<Page<OrderSummary>>(`/operations/orders?${query}`),
  getOpsOrder: (code: string) => request<{ order: Order }>(`/operations/orders/${code}`).then((r) => r.order),
  approveOrder: (code: string, startPreparing = false) =>
    request<{ order: Order }>(`/operations/orders/${code}/approve`, { method: 'PATCH', body: JSON.stringify({ startPreparing }) }).then((r) => r.order),
  transitionOrder: (code: string, to: OrderStatus, note?: string) =>
    request<{ order: Order }>(`/operations/orders/${code}/status`, { method: 'PATCH', body: JSON.stringify({ to, note }) }).then((r) => r.order),
  rejectOrder: (code: string, reasonCode: string, note?: string) =>
    request<{ order: Order }>(`/operations/orders/${code}/reject`, { method: 'PATCH', body: JSON.stringify({ reasonCode, note }) }).then((r) => r.order),
  failOrder: (code: string, reasonCode: string, note?: string) =>
    request<{ order: Order }>(`/operations/orders/${code}/fail`, { method: 'PATCH', body: JSON.stringify({ reasonCode, note }) }).then((r) => r.order),
  cancelOrder: (code: string, reasonCode: string, note?: string) =>
    request<{ order: Order }>(`/operations/orders/${code}/cancel`, { method: 'PATCH', body: JSON.stringify({ reasonCode, note }) }).then((r) => r.order),
  setPaymentStatus: (code: string, status: PaymentStatus, note?: string) =>
    request<{ order: Order }>(`/operations/orders/${code}/payment`, { method: 'PATCH', body: JSON.stringify({ status, note }) }).then((r) => r.order),
  pauseStore: (reason: string, note?: string) =>
    request<{ store: StoreStatus }>('/operations/store/pause', { method: 'POST', body: JSON.stringify({ reason, note }) }).then((r) => r.store),
  resumeStore: () =>
    request<{ store: StoreStatus }>('/operations/store/resume', { method: 'POST' }).then((r) => r.store),
};

// Server Components / Route Handlers must use `serverFetch` from
// '@/lib/server-api' — it has no 'use client' directive, so it can be
// invoked during server rendering.
