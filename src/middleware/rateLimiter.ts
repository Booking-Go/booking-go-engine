import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter — applies to all requests by IP address.
 * Default: 100 requests per 15-minute window (configurable via env).
 */
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth-specific rate limiter — stricter limits for login/register/forgot-password.
 * Prevents brute-force attacks.
 * Production: 10 req/15 min | Development: 50 req/15 min (relaxed for testing).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    return `${req.ip}:${email}`;
  },
});

/**
 * Booking creation rate limiter — prevents spam bookings.
 * Limit: 20 booking creations per 15 minutes per user IP.
 */
export const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: 'BOOKING_RATE_LIMIT_EXCEEDED',
      message: 'Too many booking requests. Please slow down and try again shortly.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Message sending rate limiter — prevents message spam.
 * Limit: 60 messages per 5 minutes per user IP.
 */
export const messageRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: {
      code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
      message: 'Too many messages sent. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
