import { Request, Response } from 'express';

import { HttpStatus } from '../core/constants';

/**
 * Catch-all 404 handler.
 * Mounted after all route definitions and before the global error handler
 * so that unmatched routes return a structured JSON response instead of
 * Express's default HTML "Cannot GET /path".
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
};
