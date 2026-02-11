import { Request, Response, NextFunction } from 'express';
import jsonwebtoken from 'jsonwebtoken';

import { AppError } from './errorHandler';
import type { AccessTokenPayload } from '../libs/jwt';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'customer' | 'business_owner' | 'admin';
  };
}

/**
 * Middleware that verifies the JWT access token from the `Authorization` header
 * and attaches the decoded user payload to `req.user`.
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('No token provided', 401);
    }

    const decoded = jsonwebtoken.verify(token, process.env.JWT_ACCESS_SECRET!) as AccessTokenPayload;

    // Map JWT payload (userId) → req.user (id) for downstream consumers
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    
    next();
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return next(err);
    }
    next(new AppError('Invalid or expired token', 401));
  }
};

/**
 * Authorization middleware factory — restricts access to users with specified roles.
 * @param roles - Allowed user roles (e.g., `'admin'`, `'business_owner'`).
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};
