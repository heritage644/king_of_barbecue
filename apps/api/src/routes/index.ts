import { Router } from 'express';
import { Role } from '@kob/core';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CartItemCreateSchema,
  CartItemUpdateSchema,
  CheckoutSchema,
  CodeParamSchema,
  LoginSchema,
  OrderListQuerySchema,
  CustomerOrdersQuerySchema,
  PauseStoreSchema,
  RegisterSchema,
  SlugParamSchema,
  StatusTransitionSchema,
  RejectOrderSchema,
  FailOrderSchema,
  CancelOrderSchema,
} from '@kob/core';
import {
  getCategories,
  getFeatured,
  getProduct,
  getProducts,
} from '../controllers/menuController';
import {
  addCartItemHandler,
  clearCartHandler,
  getCartHandler,
  removeCartItemHandler,
  updateCartItemHandler,
} from '../controllers/cartController';
import { getStatus, pause, resume } from '../controllers/storeController';
import { getOrder, placeOrder, streamOrder } from '../controllers/orderController';
import {
  approve,
  cancel,
  fail,
  getOrder as opsGetOrder,
  listOrders,
  paymentStatus,
  reject,
  streamOperations,
  transition,
} from '../controllers/operationsController';
import { login, logout, me, register } from '../controllers/authController';
import { listCustomerOrders, getCustomerOrder } from '../controllers/accountController';
import { paymentWebhook } from '../controllers/webhookController';

const OPERATIONS_ROLES = [Role.CASHIER, Role.OPERATIONS_STAFF, Role.MANAGER, Role.OWNER, Role.ADMIN];

export const apiRouter = Router();

// ---- health ----
apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'kob-api', time: new Date().toISOString() });
});

// ---- public menu ----
apiRouter.get('/categories', getCategories);
apiRouter.get('/products/featured', getFeatured);
apiRouter.get('/products', getProducts);
apiRouter.get('/products/:slug', validate('params', SlugParamSchema), getProduct);

// ---- public store status ----
apiRouter.get('/store/status', getStatus);

// ---- guest cart (Redis-backed, httpOnly cookie id) ----
apiRouter.get('/cart', getCartHandler);
apiRouter.post('/cart/items', validate('body', CartItemCreateSchema), addCartItemHandler);
apiRouter.patch('/cart/items/:productId', validate('body', CartItemUpdateSchema), updateCartItemHandler);
apiRouter.delete('/cart/items/:productId', removeCartItemHandler);
apiRouter.delete('/cart', clearCartHandler);

// ---- auth ----
apiRouter.post('/auth/register', validate('body', RegisterSchema), register);
apiRouter.post('/auth/login', validate('body', LoginSchema), login);
apiRouter.post('/auth/logout', logout);
apiRouter.get('/auth/me', requireAuth, me);

// ---- customer orders ----
apiRouter.post('/orders', validate('body', CheckoutSchema), placeOrder);
apiRouter.get('/orders/:code', validate('params', CodeParamSchema), getOrder);
apiRouter.get('/orders/:code/stream', validate('params', CodeParamSchema), streamOrder);
apiRouter.get('/account/orders', requireAuth, validate('query', CustomerOrdersQuerySchema), listCustomerOrders);
apiRouter.get('/account/orders/:code', requireAuth, getCustomerOrder);

// ---- operations ----
apiRouter.use('/operations', requireAuth, requireRole(OPERATIONS_ROLES));
apiRouter.get('/operations/orders/stream', streamOperations); // before :code
apiRouter.get('/operations/orders', validate('query', OrderListQuerySchema), listOrders);
apiRouter.get('/operations/orders/:code', validate('params', CodeParamSchema), opsGetOrder);
apiRouter.patch('/operations/orders/:code/approve', validate('params', CodeParamSchema), approve);
apiRouter.patch('/operations/orders/:code/reject', validate('params', CodeParamSchema), validate('body', RejectOrderSchema), reject);
apiRouter.patch('/operations/orders/:code/fail', validate('params', CodeParamSchema), validate('body', FailOrderSchema), fail);
apiRouter.patch('/operations/orders/:code/cancel', validate('params', CodeParamSchema), validate('body', CancelOrderSchema), cancel);
apiRouter.patch('/operations/orders/:code/status', validate('params', CodeParamSchema), validate('body', StatusTransitionSchema), transition);
apiRouter.patch('/operations/orders/:code/payment', validate('params', CodeParamSchema), paymentStatus);
apiRouter.post('/operations/store/pause', validate('body', PauseStoreSchema), pause);
apiRouter.post('/operations/store/resume', resume);

// ---- webhooks (no auth — signature-authenticated) ----
apiRouter.post('/webhooks/payment-provider', paymentWebhook);
