import { redisClient } from '../config';
import { logger } from './logger';

/**
 * Redis cache utility — wraps get/set/delete with JSON serialization and TTL.
 */
export const cache = {
  /**
   * Get a cached value by key. Returns null if not found or on error.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err: unknown) {
      logger.error('Cache GET error', { key, error: err });
      return null;
    }
  },

  /**
   * Set a value in cache with optional TTL (in seconds). Default: 300s (5 min).
   */
  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await redisClient.setEx(key, ttlSeconds, serialized);
    } catch (err: unknown) {
      logger.error('Cache SET error', { key, error: err });
    }
  },

  /**
   * Delete a cached key.
   */
  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (err: unknown) {
      logger.error('Cache DEL error', { key, error: err });
    }
  },

  /**
   * Delete all keys matching a pattern using SCAN (non-blocking, production-safe).
   * @param pattern - Glob pattern, e.g. 'business:*:slots'.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      let deletedCount = 0;
      for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        await redisClient.del(key);
        deletedCount++;
      }
      if (deletedCount > 0) {
        logger.debug('Cache invalidated', { pattern, count: deletedCount });
      }
    } catch (err: unknown) {
      logger.error('Cache INVALIDATE error', { pattern, error: err });
    }
  },
};
