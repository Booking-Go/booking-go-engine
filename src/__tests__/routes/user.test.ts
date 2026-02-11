import { api, API_PREFIX, registerUser, cleanupTestData, TestUser } from '../helpers/test-helpers';

describe('User Routes — /api/v1/users', () => {
  let customer: TestUser;
  let otherUser: TestUser;

  beforeAll(async () => {
    customer = await registerUser({ role: 'customer' });
    otherUser = await registerUser({ role: 'customer' });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ── Profile ───────────────────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('should return the authenticated user profile', async () => {
      const res = await api
        .get(`${API_PREFIX}/users/me`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(customer.email);
      expect(res.body.data).not.toHaveProperty('password_hash');
    });

    it('should reject without auth token', async () => {
      await api.get(`${API_PREFIX}/users/me`).expect(401);
    });
  });

  describe('PUT /users/me', () => {
    it('should update user profile', async () => {
      const res = await api
        .put(`${API_PREFIX}/users/me`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ firstName: 'Updated', lastName: 'Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name || res.body.data.firstName).toBe('Updated');
    });

    it('should ignore unknown fields in profile update', async () => {
      const res = await api
        .put(`${API_PREFIX}/users/me`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ email: 'try-change@test.com' })
        .expect(200);

      // Email field is silently stripped by Zod — original email unchanged
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(customer.email);
    });
  });

  // ── Notifications ─────────────────────────────────────────────────────────

  describe('Notifications', () => {
    it('should get notifications for user', async () => {
      const res = await api
        .get(`${API_PREFIX}/users/me/notifications`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should get unread notification count', async () => {
      const res = await api
        .get(`${API_PREFIX}/users/me/notifications/unread-count`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('count');
    });

    it('should mark all notifications as read', async () => {
      const res = await api
        .put(`${API_PREFIX}/users/me/notifications/read-all`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ── Admin Routes (should reject non-admin) ─────────────────────────────

  describe('Admin user endpoints (authorization)', () => {
    it('should reject GET /users for non-admin', async () => {
      const res = await api
        .get(`${API_PREFIX}/users`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should reject GET /users/:id for non-admin', async () => {
      const res = await api
        .get(`${API_PREFIX}/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should reject DELETE /users/:id for non-admin', async () => {
      const res = await api
        .delete(`${API_PREFIX}/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});
