import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '@kob/core';

type Location = 'body' | 'query' | 'params';

/**
 * Converts zod validation failures into a consistent 400 with field-level
 * details. Never lets raw client input through unvalidated.
 */
export function validate(location: Location, schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[location]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      next(AppError.validation('Invalid request.', details));
      return;
    }
    // Replace parsed/coerced values on the request.
    (req as unknown as Record<string, unknown>)[location] = result.data;
    next();
  };
}
