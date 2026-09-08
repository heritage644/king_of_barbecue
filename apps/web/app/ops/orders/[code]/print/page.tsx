import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ApiError } from '@/lib/errors';
import { serverFetch } from '@/lib/server-api';
import type { Order } from '@kob/core';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { PrintButton } from '@/components/print-button';

export const dynamic = 'force-dynamic';

/** Kitchen/cashier docket. Print styles in globals.css hide chrome + buttons. */
export default async function OpsPrintDocketPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const cookieHeader = cookies().toString();
  let order: Order;
  try {
    order = await serverFetch<{ order: Order }>(`/operations/orders/${code}`, cookieHeader).then((r) => r.order);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return <NotFoundNotice />;
    throw err;
  }

  return (
    <div className="bg-white p-6 print:p-0">
      <div className="mb-4 flex items-center justify-between no-print">
        <Link href={`/ops/orders/${order.publicCode}`} className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-brand">
          <ArrowLeft className="h-4 w-4" /> Back to order
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-md font-mono text-sm leading-relaxed">
        <header className="border-b-2 border-black pb-3 text-center">
          <h1 className="text-2xl font-black tracking-tight">KING OF BARBECUE</h1>
          <p className="text-[11px]">Takeaway &amp; Delivery · +234 800 000 0000</p>
        </header>

        <div className="mt-3 flex justify-between text-[12px]">
          <span><strong>#{order.publicCode}</strong></span>
          <span>{formatDateTime(order.createdAt)}</span>
        </div>
        <div className="mt-1 text-[12px]">
          <p><strong>Payment:</strong> {order.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID (confirm before dispatch)'}</p>
          <p><strong>Status:</strong> {order.status}</p>
          <p><strong>Fulfilment:</strong> {order.fulfillmentMethod === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'}</p>
        </div>

        <table className="mt-3 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-black text-left">
              <th className="py-1">Qty</th>
              <th>Item</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-dotted border-neutral-400 align-top">
                <td className="py-1 pr-2">{item.quantity}</td>
                <td className="py-1">
                  {item.name}
                  {item.instructions && <span className="block text-[11px] italic">“{item.instructions}”</span>}
                </td>
                <td className="py-1 text-right">{formatMoney(item.unitPriceMinor * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 space-y-1 text-[12px]">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotalMinor)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{formatMoney(order.deliveryFeeMinor)}</span></div>
          <div className="flex justify-between border-t border-black pt-1 text-sm font-bold"><span>TOTAL</span><span>{formatMoney(order.totalMinor)}</span></div>
        </div>

        <section className="mt-4 border-t border-black pt-3 text-[12px]">
          <h2 className="font-bold">CUSTOMER</h2>
          <p>{order.guestName}</p>
          <p>{order.guestPhone}</p>
          {order.fulfillmentMethod === 'DELIVERY' && (
            <>
              <p>{order.deliveryAddress}</p>
              <p>{order.deliveryArea}</p>
              {order.deliveryInstructions && <p className="italic">Note: {order.deliveryInstructions}</p>}
            </>
          )}
          {order.specialInstructions && <p className="mt-1 italic">Order note: {order.specialInstructions}</p>}
        </section>

        <footer className="mt-6 border-t-2 border-black pt-2 text-center text-[10px]">
          <p>Thank you! See you at the grill 🔥</p>
          <p className="mt-1">Order ref: {order.publicCode}</p>
        </footer>
      </div>
    </div>
  );
}

function NotFoundNotice() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-xl font-bold">Order not found</p>
      <Link href="/ops" className="text-brand underline">Back to operations board</Link>
    </div>
  );
}
