import { describe, it, expect } from 'vitest';
import { computeTotals, generatePublicOrderCode, signOrderTrackingToken, verifyOrderTrackingToken } from '../index';

describe('pricing', () => {
  it('computes totals from backend prices only', () => {
    const totals = computeTotals(
      [
        { productId: 'a', name: 'Chicken', unitPriceMinor: 450000, quantity: 2, isAvailable: true },
        { productId: 'b', name: 'Fries', unitPriceMinor: 150000, quantity: 1, isAvailable: true },
      ],
      100000,
    );
    expect(totals.subtotalMinor).toBe(1050000);
    expect(totals.deliveryFeeMinor).toBe(100000);
    expect(totals.totalMinor).toBe(1150000);
    expect(totals.itemCount).toBe(3);
  });

  it('handles an empty cart as zero', () => {
    const totals = computeTotals([], 0);
    expect(totals.totalMinor).toBe(0);
  });
});

describe('order codes', () => {
  it('generates human-friendly codes matching the pattern', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generatePublicOrderCode();
      expect(code).toMatch(/^ORD-[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('is random (no sequential leaks)', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generatePublicOrderCode()));
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe('tracking tokens', () => {
  const secret = 'test-secret';
  it('signs and verifies', () => {
    const token = signOrderTrackingToken('ORD-ABC234', secret);
    expect(verifyOrderTrackingToken(token, secret)).toBe('ORD-ABC234');
  });
  it('rejects tampering and wrong secrets', () => {
    const token = signOrderTrackingToken('ORD-ABC234', secret);
    const [payload] = token.split('.')!;
    expect(verifyOrderTrackingToken(`${payload}.tampered`, secret)).toBeNull();
    expect(verifyOrderTrackingToken(token, 'other-secret')).toBeNull();
    expect(verifyOrderTrackingToken('garbage', secret)).toBeNull();
  });
});
