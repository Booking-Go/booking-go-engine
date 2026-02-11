import supertest from 'supertest';
import app from '../../app';
import { pgPool } from '../../config';

const api = supertest(app);
const API_PREFIX = '/api/v1';

/** Unique suffix to isolate test data from seed data */
const testId = () => Math.random().toString(36).slice(2, 10);

/** Test user credentials */
interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'customer' | 'business_owner' | 'admin';
  accessToken?: string;
  refreshToken?: string;
  id?: string;
}

/**
 * Register a new test user and return credentials + tokens.
 * @param overrides - Partial user fields to override defaults
 * @returns TestUser with tokens populated
 */
const registerUser = async (overrides: Partial<TestUser> = {}): Promise<TestUser> => {
  const suffix = testId();
  const user: TestUser = {
    email: `test-${suffix}@booking-go-test.com`,
    password: 'TestPass@123',
    firstName: 'Test',
    lastName: `User${suffix}`,
    role: 'customer',
    ...overrides,
  };

  const res = await api
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    })
    .expect(201);

  user.accessToken = res.body.data.accessToken;
  user.refreshToken = res.body.data.refreshToken;
  user.id = res.body.data.user.id;

  return user;
};

/**
 * Login an existing user and return tokens.
 * @param email - User email
 * @param password - User password
 * @returns Access and refresh tokens
 */
const loginUser = async (
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }> => {
  const res = await api.post(`${API_PREFIX}/auth/login`).send({ email, password }).expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    user: res.body.data.user,
  };
};

/**
 * Create a test business for a business_owner user.
 * @param accessToken - Business owner's auth token
 * @param overrides - Partial business fields
 * @returns Created business data
 */
const createTestBusiness = async (
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> => {
  const suffix = testId();
  const res = await api
    .post(`${API_PREFIX}/businesses`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: `Test Business ${suffix}`,
      slug: `test-business-${suffix}`,
      category: 'salon',
      addressLine1: '123 Test Street',
      city: 'TestCity',
      state: 'TS',
      zipCode: '12345',
      country: 'IN',
      phone: '+911234567890',
      email: `biz-${suffix}@test.com`,
      description: 'A test business for integration tests',
      ...overrides,
    })
    .expect(201);

  return res.body.data;
};

/**
 * Create a test service for a business.
 * @param accessToken - Business owner's auth token
 * @param businessId - Business UUID
 * @param overrides - Partial service fields
 * @returns Created service data
 */
const createTestService = async (
  accessToken: string,
  businessId: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> => {
  const suffix = testId();
  const res = await api
    .post(`${API_PREFIX}/businesses/${businessId}/services`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: `Test Service ${suffix}`,
      duration: 30,
      price: 25.0,
      description: 'A test service',
      ...overrides,
    })
    .expect(201);

  return res.body.data;
};

/**
 * Create a test slot for a business service.
 * @param accessToken - Business owner's auth token
 * @param businessId - Business UUID
 * @param serviceId - Service UUID
 * @param overrides - Partial slot fields
 * @returns Created slot data
 */
const createTestSlot = async (
  accessToken: string,
  businessId: string,
  serviceId: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> => {
  // Use a future date for the slot
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const endTime = new Date(tomorrow);
  endTime.setMinutes(endTime.getMinutes() + 30);

  const res = await api
    .post(`${API_PREFIX}/slots`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      businessId,
      serviceId,
      startTime: tomorrow.toISOString(),
      endTime: endTime.toISOString(),
      price: 25.0,
      capacity: 1,
      ...overrides,
    })
    .expect(201);

  return res.body.data;
};

/**
 * Clean up test users created during tests.
 * Deletes users whose email matches the test pattern.
 */
const cleanupTestUsers = async (): Promise<void> => {
  await pgPool.query("DELETE FROM users WHERE email LIKE '%@booking-go-test.com'");
};

/**
 * Clean up all test data.
 * Removes bookings, slots, services, businesses, and users from test pattern.
 */
const cleanupTestData = async (): Promise<void> => {
  const testEmailPattern = '%@booking-go-test.com';
  const testBizPattern = '%@test.com';

  // Delete in dependency order
  await pgPool.query(
    `
    DELETE FROM bookings WHERE customer_id IN (
      SELECT id FROM users WHERE email LIKE $1
    )
  `,
    [testEmailPattern],
  );

  await pgPool.query(
    `
    DELETE FROM reviews WHERE customer_id IN (
      SELECT id FROM users WHERE email LIKE $1
    )
  `,
    [testEmailPattern],
  );

  await pgPool.query(
    `
    DELETE FROM slots WHERE business_id IN (
      SELECT id FROM businesses WHERE email LIKE $1
    )
  `,
    [testBizPattern],
  );

  await pgPool.query(
    `
    DELETE FROM services WHERE business_id IN (
      SELECT id FROM businesses WHERE email LIKE $1
    )
  `,
    [testBizPattern],
  );

  await pgPool.query(
    `
    DELETE FROM business_hours WHERE business_id IN (
      SELECT id FROM businesses WHERE email LIKE $1
    )
  `,
    [testBizPattern],
  );

  await pgPool.query(
    `
    DELETE FROM business_holidays WHERE business_id IN (
      SELECT id FROM businesses WHERE email LIKE $1
    )
  `,
    [testBizPattern],
  );

  await pgPool.query(`DELETE FROM businesses WHERE email LIKE $1`, [testBizPattern]);

  await pgPool.query(`DELETE FROM users WHERE email LIKE $1`, [testEmailPattern]);
};

export {
  api,
  API_PREFIX,
  testId,
  registerUser,
  loginUser,
  createTestBusiness,
  createTestService,
  createTestSlot,
  cleanupTestUsers,
  cleanupTestData,
};
export type { TestUser };
