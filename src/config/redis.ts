import { createClient } from 'redis';
import chalk from 'chalk';

let redisClient: ReturnType<typeof createClient> | null = null;

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT!),
      },
      password: process.env.REDIS_PASSWORD,
    });

    redisClient.on('error', (error) => {
      console.error(chalk.red('[Redis] Client error:'), error);
    });

    redisClient.on('connect', () => {
      console.log(chalk.green('[Redis] Connected successfully'));
    });

    await redisClient.connect();
  } catch (error) {
    console.error(chalk.red('[Redis] Connection error:'), error);
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    console.log('Redis connection closed');
  }
};
