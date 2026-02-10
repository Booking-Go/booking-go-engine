import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { logger } from '../libs';
import { HttpStatus } from '../core/constants';

/**
 * Custom operational error.
 * Throw this anywhere in routes/services to produce a predictable JSON response.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'APP_ERROR';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error-handling middleware (must be registered LAST).
 *
 * Produces a uniform error envelope:
 * ```json
 * { "success": false, "error": { "code": "...", "message": "...", "details?": [...] } }
 * ```
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // — Known operational error (thrown via AppError)
  if (err instanceof AppError) {
    logger.warn(err.message, {
      statusCode: err.statusCode,
      code: err.code,
      path: req.originalUrl,
      method: req.method,
      requestId: req.requestId,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // — Zod validation error (if it somehow bypasses the validate middleware)
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
  }

  // — Unexpected / programmer errors
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    requestId: req.requestId,
  });

  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Something went wrong!'
          : err.message,
    },
  });
};
