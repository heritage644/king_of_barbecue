import { cookies } from 'next/headers';
import { ApiError } from '@/lib/errors';
import { serverFetch } from '@/lib/server-api';
import type { OrderSummary, Page } from '@kob/core';
import { OpsBoard, OpsBoardSkeleton } from '@/components/ops-board';
import { StoreStatusBanner } from '@/components/store-status-banner';

export const dynamic = 'force-dynamic';

export default async function OpsDashboardPage() {
  const cookieHeader = cookies().toString();
  let page: Page<OrderSummary>;
  try {
    page = await serverFetch<Page<OrderSummary>>('/operations/orders', cookieHeader);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Client layout guard will redirect to /ops/login; render nothing sensitive.
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <OpsBoardSkeleton />
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-screen-2xl">
      <div className="py-3">
        <StoreStatusBanner />
      </div>
      <OpsBoard initialOrders={page.items} initialCursor={page.nextCursor} />
    </div>
  );
}
