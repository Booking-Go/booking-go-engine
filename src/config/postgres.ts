import { Pool, PoolClient } from 'pg';
import chalk from 'chalk';
import { logger } from '../libs';

let pool: Pool | null = null;
let healthCheckTimer: NodeJS.Timeout | null = null;

/** How often to ping the pool to evict dead connections (ms). */
const HEALTH_CHECK_INTERVAL = 30_000;

/** Initializes the PostgreSQL connection pool using environment variables. */
export const connectPostgres = async (): Promise<void> => {
  try {
    pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT!),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 20,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      allowExitOnIdle: false,
    });

    // Handle pool-level errors to prevent silent connection drops.
    pool.on('error', (err) => {
      logger.error(`[PostgreSQL] Pool error: ${err.message}`);
    });

    // Log per-client errors so dead sockets are visible.
    pool.on('connect', (client: PoolClient) => {
      client.on('error', (err) => {
        logger.error(`[PostgreSQL] Client error: ${err.message}`);
      });
    });

    // Test connection
    const client = await pool.connect();
    logger.info(chalk.green('[PostgreSQL] Connected successfully'));
    client.release();

    // Start a background health-check to evict stale connections.
    // This catches dead connections caused by Docker pauses, macOS sleep, etc.
    startHealthCheck();
  } catch (err: unknown) {
    logger.error(`${chalk.red('[PostgreSQL] Connection error:')} ${err}`);
    throw err;
  }
};

/**
 * Periodically runs a lightweight query (`SELECT 1`) to verify the pool
 * can still reach PostgreSQL. If it fails, the pool automatically drops
 * the dead connection and creates a fresh one on the next request.
 */
const startHealthCheck = () => {
  if (healthCheckTimer) clearInterval(healthCheckTimer);

  healthCheckTimer = setInterval(async () => {
    if (!pool) return;
    try {
      await pool.query('SELECT 1');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`[PostgreSQL] Health-check failed — pool will recreate connections: ${msg}`);
    }
  }, HEALTH_CHECK_INTERVAL);

  // Don't block Node.js from exiting for the timer.
  healthCheckTimer.unref();
};

/** Returns the active PostgreSQL `Pool`. Throws if not yet connected. */
export const getPostgresPool = (): Pool => {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call connectPostgres() first.');
  }
  return pool;
};

/** Gracefully closes the PostgreSQL connection pool. */
export const closePostgres = async (): Promise<void> => {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  if (pool) {
    await pool.end();
    logger.info('PostgreSQL connection closed');
  }
};
