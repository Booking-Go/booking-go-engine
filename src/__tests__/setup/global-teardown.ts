import { closePostgres, closeMongoDB, closeRedis } from '../../config';

/**
 * Global teardown — runs once after all test suites complete.
 * Closes all database connections.
 */
const globalTeardown = async () => {
  try {
    await Promise.allSettled([closePostgres(), closeMongoDB(), closeRedis()]);
    // eslint-disable-next-line no-console
    console.log('\n✅ Test databases disconnected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Error disconnecting test databases:', err);
  }
};

export default globalTeardown;
