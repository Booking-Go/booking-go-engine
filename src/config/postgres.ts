import { Pool } from 'pg';
import chalk from 'chalk';

let pool: Pool | null = null;

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
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await pool.connect();
    console.log(chalk.green('[PostgreSQL] Connected successfully'));
    client.release();
  } catch (err: unknown) {
    console.error(chalk.red('[PostgreSQL] Connection error:'), err);
    throw err;
  }
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
  if (pool) {
    await pool.end();
    console.log('PostgreSQL connection closed');
  }
};
