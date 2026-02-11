import {
  api,
  API_PREFIX,
  registerUser,
  createTestBusiness,
  cleanupTestData,
  testId,
  TestUser,
} from '../helpers/test-helpers';

describe('Business Routes — /api/v1/businesses', () => {
  let owner: TestUser;
  let customer: TestUser;
  let businessId: string;

  beforeAll(async () => {
    owner = await registerUser({ role: 'business_owner' });
    customer = await registerUser({ role: 'customer' });

    const biz = await createTestBusiness(owner.accessToken!);
    businessId = (biz as { id: string }).id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ── List Businesses ───────────────────────────────────────────────────────

  describe('GET /businesses', () => {
    it('should list businesses for authenticated user', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses?page=1&limit=5`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.meta).toHaveProperty('page');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('total');
    });

    it('should support search by name', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses?search=Test Business`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      await api.get(`${API_PREFIX}/businesses`).expect(401);
    });
  });

  // ── Get Business by ID ────────────────────────────────────────────────────

  describe('GET /businesses/:id', () => {
    it('should return a business by ID', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/${businessId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(businessId);
    });

    it('should return 404 for non-existent business', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api
        .get(`${API_PREFIX}/businesses/${fakeId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Get My Businesses ─────────────────────────────────────────────────────

  describe('GET /businesses/mine', () => {
    it('should return businesses owned by the user', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/mine`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject customer access', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/mine`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Create Business ───────────────────────────────────────────────────────

  describe('POST /businesses', () => {
    it('should allow business_owner to create a business', async () => {
      const suffix = testId();
      const res = await api
        .post(`${API_PREFIX}/businesses`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: `New Biz ${suffix}`,
          slug: `new-biz-${suffix}`,
          category: 'gym',
          addressLine1: '456 Test Ave',
          city: 'GymCity',
          state: 'GY',
          zipCode: '67890',
          country: 'IN',
          phone: '+919876543210',
          email: `newbiz-${suffix}@test.com`,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe(`New Biz ${suffix}`);
    });

    it('should reject creation by customer', async () => {
      const res = await api
        .post(`${API_PREFIX}/businesses`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          name: 'Disallowed Biz',
          slug: 'disallowed-biz',
          category: 'salon',
          addressLine1: '789 No Way',
          city: 'Nope',
          state: 'NO',
          zipCode: '00000',
          country: 'IN',
          phone: '+910000000000',
          email: 'nope@test.com',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should reject creation with missing required fields', async () => {
      const res = await api
        .post(`${API_PREFIX}/businesses`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Incomplete' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Update Business ───────────────────────────────────────────────────────

  describe('PUT /businesses/:id', () => {
    it('should update business details', async () => {
      const res = await api
        .put(`${API_PREFIX}/businesses/${businessId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ description: 'Updated description for testing' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated description for testing');
    });

    it('should reject update by non-owner', async () => {
      const res = await api
        .put(`${API_PREFIX}/businesses/${businessId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ description: 'Hacked description' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Business Hours ────────────────────────────────────────────────────────

  describe('Business Hours', () => {
    it('should set business hours', async () => {
      const hours = [
        { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isClosed: false },
        { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isClosed: false },
        { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isClosed: true },
      ];

      const res = await api
        .put(`${API_PREFIX}/businesses/${businessId}/hours`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(hours)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should get business hours', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/${businessId}/hours`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── Business Holidays ─────────────────────────────────────────────────────

  describe('Business Holidays', () => {
    let holidayId: string;

    it('should add a holiday', async () => {
      const res = await api
        .post(`${API_PREFIX}/businesses/${businessId}/holidays`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ date: '2025-12-25', reason: 'Christmas' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      holidayId = res.body.data.id;
    });

    it('should get holidays', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/${businessId}/holidays`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should remove a holiday', async () => {
      if (!holidayId) return;

      await api
        .delete(`${API_PREFIX}/businesses/${businessId}/holidays/${holidayId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(204);
    });
  });

  // ── Business Services ─────────────────────────────────────────────────────

  describe('Business Services', () => {
    let serviceId: string;

    it('should create a service', async () => {
      const res = await api
        .post(`${API_PREFIX}/businesses/${businessId}/services`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Haircut Test',
          duration: 45,
          price: 30.0,
          description: 'Test haircut service',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      serviceId = res.body.data.id;
    });

    it('should get services for a business', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/${businessId}/services`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should get a specific service', async () => {
      if (!serviceId) return;

      const res = await api
        .get(`${API_PREFIX}/businesses/${businessId}/services/${serviceId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(serviceId);
    });

    it('should update a service', async () => {
      if (!serviceId) return;

      const res = await api
        .put(`${API_PREFIX}/businesses/${businessId}/services/${serviceId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ price: 35.0 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should reject service creation by customer', async () => {
      const res = await api
        .post(`${API_PREFIX}/businesses/${businessId}/services`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          name: 'Unauthorized Service',
          duration: 30,
          price: 20.0,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});
