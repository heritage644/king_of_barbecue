export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STORE_PAUSED'
  | 'CART_EMPTY'
  | 'PRODUCT_UNAVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static validation(message: string, details?: unknown) {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }
  static unauthorized(message = 'Authentication required.') {
    return new AppError('UNAUTHORIZED', message, 401);
  }
  static forbidden(message = 'You do not have permission to perform this action.') {
    return new AppError('FORBIDDEN', message, 403);
  }
  static notFound(message = 'Resource not found.') {
    return new AppError('NOT_FOUND', message, 404);
  }
  static conflict(message: string) {
    return new AppError('CONFLICT', message, 409);
  }
  static storePaused(message = 'Services are temporarily on hold. Please check back shortly.') {
    return new AppError('STORE_PAUSED', message, 409);
  }
  static cartEmpty() {
    return new AppError('CART_EMPTY', 'Your cart is empty.', 400);
  }
  static unavailable(message: string, details?: unknown) {
    return new AppError('PRODUCT_UNAVAILABLE', message, 409, details);
  }
  static internal(message = 'Something went wrong.') {
    return new AppError('INTERNAL_ERROR', message, 500);
  }
}
