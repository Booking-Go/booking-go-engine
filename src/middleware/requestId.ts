import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Injects a unique X-Request-ID into every request.
 * If the client already provides one, it is reused; otherwise a new UUID is generated.
 * The ID is attached to both `req.requestId` and the response header so downstream
 * consumers (logs, services, clients) can correlate the full request lifecycle.
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-ID', id);

  next();
};
