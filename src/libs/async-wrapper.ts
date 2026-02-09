import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler so thrown errors are forwarded to Express error middleware.
 * Usage: router.get('/path', asyncWrapper(async (req, res) => { ... }));
 */
export const asyncWrapper = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};
