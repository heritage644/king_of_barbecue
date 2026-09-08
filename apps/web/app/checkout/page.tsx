'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/utils';
import type { Cart, StoreStatus } from '@kob/core';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from '@/components/ui';

type Fulfillment = 'PICKUP' | 'DELIVERY';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [store, setStore] = useState<StoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
  );

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('PICKUP');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MANUAL' | 'CASH_ON_DELIVERY'>('MANUAL');

  useEffect(() => {
    Promise.all([apiClient.getCart(), apiClient.getStoreStatus()])
      .then(([c, s]) => {
        setCart(c);
        setStore(s);
      })
      .catch(() => setError('Could not load your cart. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => {
    if (!cart) return 0;
    const deliveryFee = fulfillment === 'DELIVERY' ? (store?.deliveryFeeMinor ?? 0) : 0;
    return (cart.subtotalMinor ?? 0) + deliveryFee;
  }, [cart, fulfillment, store]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiClient.placeOrder(
        {
          guestName,
          guestEmail,
          guestPhone,
          fulfillmentMethod: fulfillment,
          deliveryAddress: fulfillment === 'DELIVERY' ? address : null,
          deliveryArea: fulfillment === 'DELIVERY' ? area : null,
          deliveryInstructions: fulfillment === 'DELIVERY' ? deliveryInstructions || null : null,
          specialInstructions: specialInstructions || null,
          paymentMethod,
        },
        idempotencyKey,
      );
      router.replace(`/order/${result.order.publicCode}?placed=1`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'STORE_PAUSED' ? 'Services are temporarily on hold. Please check back shortly.' : err.message);
      } else {
        setError('Something went wrong while placing your order. Please try again.');
      }
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-neutral-500">Loading checkout…</div>;
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Your cart is empty</h1>
        <Link href="/menu" className="mt-4 inline-block text-brand underline">Back to the menu</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold">Checkout</h1>
      <p className="mt-1 text-neutral-500">No account needed — guests always welcome.</p>

      <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Full name *</Label>
                <Input id="name" required minLength={2} value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" required value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" type="tel" required minLength={7} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} autoComplete="tel" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fulfilment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFulfillment('PICKUP')}
                  className={`rounded-xl border-2 p-4 text-left transition ${fulfillment === 'PICKUP' ? 'border-brand bg-brand/5' : 'border-neutral-200 hover:border-neutral-300'}`}
                >
                  <span className="block font-semibold">Pickup</span>
                  <span className="text-xs text-neutral-500">Ready at the counter</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillment('DELIVERY')}
                  className={`rounded-xl border-2 p-4 text-left transition ${fulfillment === 'DELIVERY' ? 'border-brand bg-brand/5' : 'border-neutral-200 hover:border-neutral-300'}`}
                >
                  <span className="block font-semibold">Delivery</span>
                  <span className="text-xs text-neutral-500">
                    {store?.deliveryFeeMinor ? `${formatMoney(store.deliveryFeeMinor)} fee` : 'To your door'}
                  </span>
                </button>
              </div>

              {fulfillment === 'DELIVERY' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="address">Delivery address *</Label>
                    <Input id="address" required minLength={5} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, building, landmark…" />
                  </div>
                  <div>
                    <Label htmlFor="area">Area / location *</Label>
                    <Input id="area" required minLength={2} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Awka South" />
                  </div>
                  <div>
                    <Label htmlFor="deliveryInstructions">Delivery instructions</Label>
                    <Input id="deliveryInstructions" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} placeholder="Call on arrival etc." />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="specialInstructions">Order instructions</Label>
                <Textarea id="specialInstructions" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} maxLength={500} placeholder="No pepper, extra sauce, cutlery…" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('MANUAL')}
                  className={`rounded-xl border-2 p-4 text-left transition ${paymentMethod === 'MANUAL' ? 'border-brand bg-brand/5' : 'border-neutral-200 hover:border-neutral-300'}`}
                >
                  <span className="block font-semibold">Pay on confirmation</span>
                  <span className="text-xs text-neutral-500">We&apos;ll confirm your payment by phone/WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                  className={`rounded-xl border-2 p-4 text-left transition ${paymentMethod === 'CASH_ON_DELIVERY' ? 'border-brand bg-brand/5' : 'border-neutral-200 hover:border-neutral-300'}`}
                >
                  <span className="block font-semibold">Cash on delivery</span>
                  <span className="text-xs text-neutral-500">Pay the rider when your order arrives</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="h-fit space-y-4">
          <Card>
            <CardHeader><CardTitle>Order summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-2">
                {cart.lines.map((line) => (
                  <li key={line.productId} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{line.quantity}× {line.name}</span>
                    <span className="shrink-0 font-medium">{formatMoney(line.lineTotalMinor)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t pt-3">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(cart.subtotalMinor)}</span></div>
                <div className="mt-1 flex justify-between">
                  <span>Delivery fee</span>
                  <span>{fulfillment === 'DELIVERY' ? formatMoney(store?.deliveryFeeMinor ?? 0) : formatMoney(0)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span><span>{formatMoney(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
            {submitting ? 'Placing order…' : 'Place order'}
          </Button>
          <p className="text-center text-xs text-neutral-400">
            By ordering you agree to our standard pickup/delivery terms. Order total is confirmed by the kitchen.
          </p>
        </aside>
      </form>
    </div>
  );
}
