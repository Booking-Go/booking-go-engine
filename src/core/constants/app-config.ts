/**
 * Pagination defaults and limits.
 */
export const Pagination = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * App-level configuration constants.
 */
export const AppConfig = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  SLUG_MAX_LENGTH: 100,
  MAX_SERVICES_PER_BUSINESS: 50,
  MAX_SLOTS_BULK_CREATE: 500,
  REVIEW_MIN_RATING: 1,
  REVIEW_MAX_RATING: 5,
} as const;
