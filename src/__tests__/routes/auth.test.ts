import { api, API_PREFIX, cleanupTestUsers, testId } from '../helpers/test-helpers';

describe('Auth Routes — /api/v1/auth', () => {
  const testEmails: string[] = [];

  afterAll(async () => {
    await cleanupTestUsers();
  });

  // ── Registration ──────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new customer successfully', async () => {
      const suffix = testId();
      const email = `test-${suffix}@booking-go-test.com`;
      testEmails.push(email);

      const res = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'SecurePass@1',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.role).toBe('customer');
      expect(res.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should register a business_owner successfully', async () => {
      const suffix = testId();
      const email = `test-${suffix}@booking-go-test.com`;
      testEmails.push(email);

      const res = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'SecurePass@1',
          firstName: 'Jane',
          lastName: 'Owner',
          role: 'business_owner',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('business_owner');
    });

    it('should reject registration with duplicate email', async () => {
      const suffix = testId();
      const email = `test-${suffix}@booking-go-test.com`;
      testEmails.push(email);

      // Register first time
      await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'SecurePass@1',
          firstName: 'First',
          lastName: 'User',
        })
        .expect(201);

      // Try again with same email
      const res = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'SecurePass@1',
          firstName: 'Duplicate',
          lastName: 'User',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('should reject registration with invalid email', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: 'not-an-email',
          password: 'SecurePass@1',
          firstName: 'Bad',
          lastName: 'Email',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject registration with weak password', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `test-${testId()}@booking-go-test.com`,
          password: '123',
          firstName: 'Weak',
          lastName: 'Pass',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject registration with missing fields', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: `test-${testId()}@booking-go-test.com`,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    const loginEmail = `test-login-${testId()}@booking-go-test.com`;
    const loginPassword = 'LoginPass@1';

    beforeAll(async () => {
      testEmails.push(loginEmail);
      await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: loginEmail,
          password: loginPassword,
          firstName: 'Login',
          lastName: 'User',
        })
        .expect(201);
    });

    it('should login with valid credentials', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: loginEmail, password: loginPassword })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe(loginEmail);
    });

    it('should reject login with wrong password', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: loginEmail, password: 'WrongPass@1' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject login with non-existent email', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: 'nonexistent@booking-go-test.com', password: loginPassword })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Token Refresh ─────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const suffix = testId();
      const email = `test-${suffix}@booking-go-test.com`;
      testEmails.push(email);

      const registerRes = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'RefreshPass@1',
          firstName: 'Refresh',
          lastName: 'User',
        })
        .expect(201);

      const { refreshToken } = registerRes.body.data;

      const res = await api.post(`${API_PREFIX}/auth/refresh`).send({ refreshToken }).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refreshToken: 'invalid-token-string' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const suffix = testId();
      const email = `test-${suffix}@booking-go-test.com`;
      testEmails.push(email);

      const registerRes = await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'LogoutPass@1',
          firstName: 'Logout',
          lastName: 'User',
        })
        .expect(201);

      const { accessToken } = registerRes.body.data;

      const res = await api
        .post(`${API_PREFIX}/auth/logout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should reject logout without auth token', async () => {
      const res = await api.post(`${API_PREFIX}/auth/logout`).expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Forgot Password ──────────────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('should accept forgot password for existing user', async () => {
      const suffix = testId();
      const email = `test-${suffix}@booking-go-test.com`;
      testEmails.push(email);

      await api
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email,
          password: 'ForgotPass@1',
          firstName: 'Forgot',
          lastName: 'User',
        })
        .expect(201);

      const res = await api.post(`${API_PREFIX}/auth/forgot-password`).send({ email }).expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 200 even for non-existent email (no info leak)', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/forgot-password`)
        .send({ email: 'no-such-user@booking-go-test.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const res = await api
        .post(`${API_PREFIX}/auth/forgot-password`)
        .send({ email: 'invalid' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Protected Route Access ────────────────────────────────────────────────

  describe('Authentication guard', () => {
    it('should reject requests with no token', async () => {
      const res = await api.get(`${API_PREFIX}/users/me`).expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject requests with malformed token', async () => {
      const res = await api
        .get(`${API_PREFIX}/users/me`)
        .set('Authorization', 'Bearer malformed.token.value')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
