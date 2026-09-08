import { Role, ROLES } from './constants';

/**
 * Role-based access control matrix for Phase 1.
 *
 * The API is the enforcement layer — the frontend only uses this to decide
 * what to render. Every operational route re-checks the role server-side.
 *
 * Future modules (supplier, inventory, logistics, delivery partner) will add
 * resource-scoped checks on top; this matrix is the coarse gate.
 */

export const OPERATIONS_ROLES: Role[] = [
  Role.CASHIER,
  Role.OPERATIONS_STAFF,
  Role.MANAGER,
  Role.OWNER,
  Role.ADMIN,
];

export const CUSTOMER_ROLES: Role[] = [Role.CUSTOMER];

/** Roles allowed to toggle the master store pause. */
export const STORE_CONTROL_ROLES: Role[] = [
  Role.CASHIER,
  Role.OPERATIONS_STAFF,
  Role.MANAGER,
  Role.OWNER,
  Role.ADMIN,
];

/** Roles allowed to execute order mutations (approve/reject/status/cancel). */
export const ORDER_ACTION_ROLES: Role[] = [...OPERATIONS_ROLES];

/** Roles allowed to update payment state manually. */
export const PAYMENT_ACTION_ROLES: Role[] = [...OPERATIONS_ROLES];

/** Roles allowed to see the operational realtime feed. */
export const OPERATIONS_FEED_ROLES: Role[] = [...OPERATIONS_ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  [Role.CUSTOMER]: 'Customer',
  [Role.CASHIER]: 'Cashier',
  [Role.OPERATIONS_STAFF]: 'Operations Staff',
  [Role.MANAGER]: 'Manager',
  [Role.OWNER]: 'Owner',
  [Role.SUPPLIER]: 'Supplier',
  [Role.INVENTORY_STAFF]: 'Inventory Staff',
  [Role.KITCHEN_STAFF]: 'Kitchen Staff',
  [Role.LOGISTICS]: 'Logistics',
  [Role.DELIVERY_PARTNER]: 'Delivery Partner',
  [Role.ADMIN]: 'Administrator',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value);
}

export function canAccessOperations(role: Role | undefined | null): boolean {
  return !!role && OPERATIONS_ROLES.includes(role);
}

export function canControlStore(role: Role | undefined | null): boolean {
  return !!role && STORE_CONTROL_ROLES.includes(role);
}

export function canMutateOrders(role: Role | undefined | null): boolean {
  return !!role && ORDER_ACTION_ROLES.includes(role);
}

export function canMutatePayments(role: Role | undefined | null): boolean {
  return !!role && PAYMENT_ACTION_ROLES.includes(role);
}

export function canViewOperationsFeed(role: Role | undefined | null): boolean {
  return !!role && OPERATIONS_FEED_ROLES.includes(role);
}

/**
 * Future extension points (documented, not implemented in Phase 1):
 *  - SUPPLIER: only own supplier catalogue, POs and deliveries.
 *  - INVENTORY_STAFF: stock movements, adjustments, purchase requests.
 *  - KITCHEN_STAFF: read active orders, update preparation status.
 *  - LOGISTICS / DELIVERY_PARTNER: dispatch & delivery updates only.
 */
export const FUTURE_ROLE_SCOPES: Record<string, string> = {
  [Role.SUPPLIER]: 'supplier-resources',
  [Role.INVENTORY_STAFF]: 'inventory-resources',
  [Role.KITCHEN_STAFF]: 'kitchen-orders',
  [Role.LOGISTICS]: 'dispatch-resources',
  [Role.DELIVERY_PARTNER]: 'delivery-resources',
};
