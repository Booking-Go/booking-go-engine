export { connectPostgres, getPostgresPool, closePostgres } from './postgres';
export { connectMongoDB, closeMongoDB } from './mongodb';
export { connectRedis, getRedisClient, closeRedis } from './redis';

// Re-export getters as lazy accessors for convenience.
// Usage: import { pgPool, redisClient } from '../config';
// These call the getter functions — will throw if DBs not yet connected.

/** Lazy-loaded proxy to the PostgreSQL `Pool` instance. */
export const pgPool = new Proxy({} as ReturnType<typeof import('./postgres').getPostgresPool>, {
  get(_, prop) {
    const { getPostgresPool } = require('./postgres');
    return (getPostgresPool() as Record<string | symbol, unknown>)[prop];
  },
});

/** Lazy-loaded proxy to the Redis client instance. */
export const redisClient = new Proxy({} as ReturnType<typeof import('./redis').getRedisClient>, {
  get(_, prop) {
    const { getRedisClient } = require('./redis');
    const client = getRedisClient();
    const value = (client as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
