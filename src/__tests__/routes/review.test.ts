import {
  api,
  API_PREFIX,
  registerUser,
  createTestBusiness,
  createTestService,
  createTestSlot,
  cleanupTestData,
  TestUser,
} from '../helpers/test-helpers';

describe('Review Routes — POST /bookings/:id/review & GET /businesses/:id/reviews', () => {
  let owner: TestUser;
  let customer: TestUser;
  let businessId: string;
  let completedBookingId: string;

  beforeAll(async () => {
    // Setup: owner creates business → service → slot → customer books → owner completes
    owner = await registerUser({ role: 'business_owner' });
    customer = await registerUser({ role: 'customer' });

    const biz = (await createTestBusiness(owner.accessToken!)) as { id: string };
    businessId = biz.id;

    const svc = (await createTestService(owner.accessToken!, businessId)) as { id: string };
    const slot = (await createTestSlot(owner.accessToken!, businessId, svc.id)) as { id: string };

    // Customer books, owner confirms and completes
    const bookRes = await api
      .post(`${API_PREFIX}/bookings`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ slotId: slot.id })
      .expect(201);

    completedBookingId = bookRes.body.data.id;

    await api
      .post(`${API_PREFIX}/bookings/${completedBookingId}/confirm`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    await api
      .post(`${API_PREFIX}/bookings/${completedBookingId}/complete`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ── Create Review ─────────────────────────────────────────────────────────

  describe('POST /bookings/:id/review', () => {
    it('should create a review for a completed booking', async () => {
      const res = await api
        .post(`${API_PREFIX}/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          rating: 5,
          comment: 'Excellent service! Highly recommended.',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.rating).toBe(5);
    });

    it('should reject duplicate review for same booking', async () => {
      const res = await api
        .post(`${API_PREFIX}/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ rating: 4, comment: 'Trying again' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('should reject invalid rating (out of range)', async () => {
      const res = await api
        .post(`${API_PREFIX}/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ rating: 6 })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject review by non-customer of the booking', async () => {
      const res = await api
        .post(`${API_PREFIX}/bookings/${completedBookingId}/review`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ rating: 3 })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Get Reviews ───────────────────────────────────────────────────────────

  describe('GET /businesses/:id/reviews', () => {
    it('should get reviews for a business', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/${businessId}/reviews`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination', async () => {
      const res = await api
        .get(`${API_PREFIX}/businesses/${businessId}/reviews?page=1&limit=5`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('meta');
    });
  });
});
