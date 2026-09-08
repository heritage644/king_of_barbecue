import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ---------- Button (shadcn-style) ----------
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
        secondary: 'bg-charcoal-light text-cream hover:bg-charcoal-lighter',
        outline: 'border border-neutral-300 bg-white text-charcoal hover:bg-neutral-50',
        ghost: 'text-charcoal hover:bg-neutral-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        success: 'bg-green-600 text-white hover:bg-green-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

// ---------- Badge ----------
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  { variants: { variant: { default: 'border-neutral-200 bg-neutral-100 text-neutral-700' } }, defaultVariants: { variant: 'default' } },
);
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

// ---------- Card ----------
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-xl border border-neutral-200 bg-white shadow-card', className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-5', className)} {...props} />
);
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-bold leading-none tracking-tight', className)} {...props} />
);
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-5 pt-0', className)} {...props} />
);
export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center p-5 pt-0', className)} {...props} />
);

// ---------- Form primitives ----------
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-sm font-medium text-charcoal', className)} {...props} />
  ),
);
Label.displayName = 'Label';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('animate-pulse rounded-md bg-neutral-200', className)} {...props} />
);

export const Separator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('h-px w-full bg-neutral-200', className)} {...props} />
);

// ---------- StatusBadge ----------
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@kob/core';

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <Badge className={cn(meta.badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const meta = PAYMENT_STATUS_META[status];
  return <Badge className={cn(meta.badge, className)}>{meta.label}</Badge>;
}
