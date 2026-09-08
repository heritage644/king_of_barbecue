import { describe, it, expect } from 'vitest';
import { Role, canAccessOperations, canControlStore, canMutateOrders, canMutatePayments, canViewOperationsFeed } from '../index';

describe('role authorization matrix', () => {
  const ops = [Role.CASHIER, Role.OPERATIONS_STAFF, Role.MANAGER, Role.OWNER, Role.ADMIN];
  const nonOps = [Role.CUSTOMER, Role.SUPPLIER, Role.INVENTORY_STAFF, Role.KITCHEN_STAFF, Role.LOGISTICS, Role.DELIVERY_PARTNER];

  it('operational roles can access operations', () => {
    for (const role of ops) {
      expect(canAccessOperations(role)).toBe(true);
      expect(canControlStore(role)).toBe(true);
      expect(canMutateOrders(role)).toBe(true);
      expect(canMutatePayments(role)).toBe(true);
      expect(canViewOperationsFeed(role)).toBe(true);
    }
  });

  it('customers and future-role users are denied', () => {
    for (const role of nonOps) {
      expect(canAccessOperations(role)).toBe(false);
      expect(canControlStore(role)).toBe(false);
      expect(canMutateOrders(role)).toBe(false);
      expect(canMutatePayments(role)).toBe(false);
      expect(canViewOperationsFeed(role)).toBe(false);
    }
  });

  it('denies anonymous', () => {
    expect(canAccessOperations(null)).toBe(false);
    expect(canMutateOrders(undefined)).toBe(false);
  });
});
