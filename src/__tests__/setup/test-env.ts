import dotenv from 'dotenv';
import {
  connectPostgres,
  connectMongoDB,
  connectRedis,
  closePostgres,
  closeMongoDB,
  closeRedis,
} from '../../config';

dotenv.config();

beforeAll(async () => {
  await connectPostgres();
  await connectMongoDB();
  await connectRedis();
});

afterAll(async () => {
  await Promise.allSettled([closePostgres(), closeMongoDB(), closeRedis()]);
});
