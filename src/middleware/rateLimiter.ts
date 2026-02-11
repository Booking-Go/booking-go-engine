import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter — applies to all requests by IP address.
 */
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS!),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS!),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth-specific rate limiter — stricter limits for login/register/forgot-password.
 * Prevents brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + email for more granular limiting
    const email = req.body?.email || '';
    return `${req.ip}:${email}`;
  },
});
