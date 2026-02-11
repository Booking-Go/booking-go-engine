import { createClient } from 'redis';
import chalk from 'chalk';

let redisClient: ReturnType<typeof createClient> | null = null;

/** Initializes the Redis client and establishes a connection. */
export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT!),
      },
      password: process.env.REDIS_PASSWORD,
    });

    redisClient.on('error', (err: unknown) => {
      console.error(chalk.red('[Redis] Client error:'), err);
    });

    redisClient.on('connect', () => {
      console.log(chalk.green('[Redis] Connected successfully'));
    });

    await redisClient.connect();
  } catch (err: unknown) {
    console.error(chalk.red('[Redis] Connection error:'), err);
    throw err;
  }
};

/** Returns the active Redis client. Throws if not yet connected. */
export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

/** Gracefully closes the Redis connection. */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    console.log('Redis connection closed');
  }
};
