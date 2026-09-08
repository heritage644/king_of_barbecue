import { z } from 'zod';
import { REJECTION_REASON_CODES, FAILURE_REASON_CODES, CANCEL_REASON_CODES, STORE_PAUSE_REASONS, ROLES, FulfillmentMethod, PaymentMethod } from './constants';
import { ROLE_LABELS } from './roles';
import { MAX_ITEM_QUANTITY } from './pricing';

/**
 * Request/query validation. The API validates every body/query/param with
 * these schemas — the same schemas are reused by the web app for client-side
 * UX hints, but the server remains the authority.
 */

const email = z.string().trim().email('Enter a valid email address.').max(254).transform((v) => v.toLowerCase());
const phone = z.string().trim().min(7, 'Enter a valid phone number.').max(20);
const name = z.string().trim().min(2, 'Enter your full name.').max(120);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128)
  .regex(/[a-zA-Z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

export const RegisterSchema = z.object({
  fullName: name,
  email,
  phone: phone.optional().nullable(),
  password,
  orderCode: z.string().trim().max(32).optional().nullable(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CartItemCreateSchema = z.object({
  productId: z.string().uuid('Invalid product.'),
  quantity: z.coerce.number().int().min(1).max(MAX_ITEM_QUANTITY).default(1),
  instructions: z.string().trim().max(300).default(''),
});
export type CartItemCreateInput = z.infer<typeof CartItemCreateSchema>;

export const CartItemUpdateSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(MAX_ITEM_QUANTITY),
  instructions: z.string().trim().max(300).optional(),
});
export type CartItemUpdateInput = z.infer<typeof CartItemUpdateSchema>;

export const CheckoutSchema = z.object({
  guestName: name,
  guestEmail: email,
  guestPhone: phone,
  fulfillmentMethod: z.enum([FulfillmentMethod.PICKUP, FulfillmentMethod.DELIVERY]),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  deliveryArea: z.string().trim().max(120).optional().nullable(),
  deliveryInstructions: z.string().trim().max(500).optional().nullable(),
  specialInstructions: z.string().trim().max(500).optional().nullable(),
  paymentMethod: z
    .enum([PaymentMethod.MANUAL, PaymentMethod.CASH_ON_DELIVERY])
    .default(PaymentMethod.MANUAL),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type CheckoutValidationInput = {
  fulfillmentMethod: string;
  deliveryAddress?: string | null;
  deliveryArea?: string | null;
};

/** Conditional requirement enforced by the service (server authority). */
export function assertCheckoutConditionalRules(data: CheckoutValidationInput): void {
  if (data.fulfillmentMethod === FulfillmentMethod.DELIVERY) {
    if (!data.deliveryAddress || data.deliveryAddress.trim().length < 5) {
      throw new Error('A delivery address is required.');
    }
    if (!data.deliveryArea || data.deliveryArea.trim().length < 2) {
      throw new Error('A delivery area/location is required.');
    }
  }
}

export const RejectOrderSchema = z.object({
  reasonCode: z.enum(REJECTION_REASON_CODES as [string, ...string[]]),
  note: z.string().trim().max(500).optional().default(''),
});
export type RejectOrderInput = z.infer<typeof RejectOrderSchema>;

export const FailOrderSchema = z.object({
  reasonCode: z.enum(FAILURE_REASON_CODES as [string, ...string[]]),
  note: z.string().trim().max(500).optional().default(''),
});
export type FailOrderInput = z.infer<typeof FailOrderSchema>;

export const CancelOrderSchema = z.object({
  reasonCode: z.enum(CANCEL_REASON_CODES as [string, ...string[]]),
  note: z.string().trim().max(500).optional().default(''),
});
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

export const PauseStoreSchema = z.object({
  reason: z.enum(STORE_PAUSE_REASONS as [string, ...string[]]).default('TEMPORARY_HOLD'),
  note: z.string().trim().max(300).optional().nullable(),
});
export type PauseStoreInput = z.infer<typeof PauseStoreSchema>;

export const StatusTransitionSchema = z.object({
  to: z.enum(['APPROVED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']),
});
export type StatusTransitionInput = z.infer<typeof StatusTransitionSchema>;

export const OrderListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  paymentStatus: z.string().trim().max(40).optional(),
  fulfillmentMethod: z.string().trim().max(20).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type OrderListQueryInput = z.infer<typeof OrderListQuerySchema>;

export const CustomerOrdersQuerySchema = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerOrdersQuery = z.infer<typeof CustomerOrdersQuerySchema>;

export const CodeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^ORD-[A-Z2-9]{6}$/i, 'Invalid order code.'),
});
export type CodeParam = z.infer<typeof CodeParamSchema>;

export const SlugParamSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});
export type SlugParam = z.infer<typeof SlugParamSchema>;

export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid resource id.'),
});
export type IdParam = z.infer<typeof IdParamSchema>;

export const RoleUpdateSchema = z.object({
  role: z.enum(ROLES as unknown as [string, ...string[]]),
});
export type RoleUpdateInput = z.infer<typeof RoleUpdateSchema>;

export const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

export const CheckoutResponseSchema = z.object({
  orderCode: z.string(),
  trackingToken: z.string(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
