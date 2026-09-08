'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui';

/** Client-only trigger for the browser print dialog (docket pages). */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}
