import { Response, NextFunction } from 'express';

import { ActivityLog } from '../models';
import { logger } from '../libs';
import { AuthRequest } from './auth';

/**
 * Maps METHOD + path patterns to human-readable activity actions.
 * Patterns are matched top-to-bottom; first match wins.
 */
const ROUTE_ACTION_MAP: { method: string; pattern: RegExp; action: string; resourceType: string }[] = [
  // Auth
  { method: 'POST', pattern: /\/auth\/register$/, action: 'user_registered', resourceType: 'user' },
  { method: 'POST', pattern: /\/auth\/login$/, action: 'user_login', resourceType: 'user' },
  { method: 'POST', pattern: /\/auth\/logout$/, action: 'user_logout', resourceType: 'user' },
  { method: 'POST', pattern: /\/auth\/reset-password$/, action: 'password_reset', resourceType: 'user' },

  // Businesses
  { method: 'POST', pattern: /\/businesses$/, action: 'business_created', resourceType: 'business' },
  { method: 'PUT', pattern: /\/businesses\/[\w-]+$/, action: 'business_updated', resourceType: 'business' },
  { method: 'PATCH', pattern: /\/businesses\/[\w-]+$/, action: 'business_updated', resourceType: 'business' },

  // Services
  { method: 'POST', pattern: /\/services$/, action: 'service_created', resourceType: 'service' },

  // Slots
  { method: 'POST', pattern: /\/slots$/, action: 'slot_created', resourceType: 'slot' },

  // Bookings
  { method: 'POST', pattern: /\/bookings$/, action: 'booking_created', resourceType: 'booking' },
  { method: 'POST', pattern: /\/bookings\/[\w-]+\/confirm$/, action: 'booking_confirmed', resourceType: 'booking' },
  { method: 'POST', pattern: /\/bookings\/[\w-]+\/cancel$/, action: 'booking_cancelled', resourceType: 'booking' },
  { method: 'POST', pattern: /\/bookings\/[\w-]+\/complete$/, action: 'booking_completed', resourceType: 'booking' },

  // Reviews
  { method: 'POST', pattern: /\/reviews$/, action: 'review_created', resourceType: 'review' },
];

/**
 * Extracts the resource ID from a request path (the first UUID-like segment after a resource name).
 */
const extractResourceId = (path: string): string | undefined => {
  const match = path.match(/\/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})/i);
  return match?.[1];
};

/**
 * Automatic activity logging middleware.
 *
 * Listens to the response `finish` event and, for mutating requests that
 * succeed (2xx), writes an activity log entry to MongoDB asynchronously.
 * Logging failures are silently swallowed so they never impact the user request.
 */
export const activityLogger = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Only log mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  res.on('finish', () => {
    // Only log successful responses
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    // Skip if no authenticated user
    if (!req.user) return;

    const matched = ROUTE_ACTION_MAP.find(
      (r) => r.method === req.method && r.pattern.test(req.originalUrl),
    );

    if (!matched) return;

    // Fire-and-forget — never block the response
    ActivityLog.create({
      userId: req.user.id,
      userRole: req.user.role,
      action: matched.action,
      resourceType: matched.resourceType,
      resourceId: extractResourceId(req.originalUrl),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        requestId: req.requestId,
      },
    }).catch((err) => {
      logger.warn('Failed to write activity log', { error: err.message, requestId: req.requestId });
    });
  });

  next();
};
