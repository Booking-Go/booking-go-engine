import { connectPostgres, connectMongoDB, connectRedis } from '../../config';

/**
 * Global setup — runs once before all test suites.
 * Connects to PostgreSQL, MongoDB, and Redis.
 */
const globalSetup = async () => {
  process.env.NODE_ENV = 'test';

  try {
    await connectPostgres();
    await connectMongoDB();
    await connectRedis();
    // eslint-disable-next-line no-console
    console.log('\n✅ Test databases connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to connect test databases:', err);
    process.exit(1);
  }
};

export default globalSetup;
