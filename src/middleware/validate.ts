import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

import { HttpStatus } from '../core/constants';

/**
 * Generic Zod validation middleware factory.
 *
 * Usage:
 *   router.post('/', validate(createBookingSchema, 'body'), handler);
 *   router.get('/:id', validate(uuidParamSchema, 'params'), handler);
 *   router.get('/', validate(paginationQuerySchema, 'query'), handler);
 *
 * On success the parsed (and coerced) data replaces the raw req source,
 * so downstream handlers receive clean, typed values.
 */
export const validate = (
  schema: ZodSchema,
  source: 'body' | 'params' | 'query' = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);

      // Replace raw data with Zod-parsed (coerced & defaulted) values
      req[source] = parsed;

      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details,
          },
        });

        return;
      }

      next(err);
    }
  };
};
