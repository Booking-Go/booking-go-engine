/**
 * Cache key patterns and TTLs used by the cache utility (libs/cache.ts).
 * Centralised here so invalidation logic stays consistent.
 */
export const CacheKeys = {
  // Slot availability: business:{id}:slots:{date}
  slotAvailability: (businessId: string, date: string) =>
    `business:${businessId}:slots:${date}`,

  // Business profile: business:{id}
  businessProfile: (businessId: string) =>
    `business:${businessId}:profile`,

  // Business services: business:{id}:services
  businessServices: (businessId: string) =>
    `business:${businessId}:services`,

  // Business analytics: business:{id}:analytics
  businessAnalytics: (businessId: string) =>
    `business:${businessId}:analytics`,

  // User session / refresh token blacklist
  refreshToken: (userId: string) =>
    `auth:refresh:${userId}`,

  // Token blacklist (for logout)
  tokenBlacklist: (tokenId: string) =>
    `auth:blacklist:${tokenId}`,

  // Rate limiting per user
  rateLimit: (userId: string, endpoint: string) =>
    `ratelimit:${userId}:${endpoint}`,
} as const;

/**
 * TTL values in seconds.
 */
export const CacheTTL = {
  SLOT_AVAILABILITY: 60,        // 1 min — changes frequently
  BUSINESS_PROFILE: 300,        // 5 min
  BUSINESS_SERVICES: 300,       // 5 min
  BUSINESS_ANALYTICS: 300,      // 5 min
  REFRESH_TOKEN: 60 * 60 * 24 * 30, // 30 days
  TOKEN_BLACKLIST: 60 * 60,     // 1 hour (match access token expiry)
} as const;
