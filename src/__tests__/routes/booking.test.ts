import {
  api,
  API_PREFIX,
  registerUser,
  createTestBusiness,
  createTestService,
  createTestSlot,
  cleanupTestData,
  testId,
  TestUser,
} from '../helpers/test-helpers';

describe('Booking & Slot Routes — /api/v1/bookings & /api/v1/slots', () => {
  let owner: TestUser;
  let customer: TestUser;
  let businessId: string;
  let serviceId: string;
  let slotId: string;
  let bookingId: string;

  beforeAll(async () => {
    owner = await registerUser({ role: 'business_owner' });
    customer = await registerUser({ role: 'customer' });

    const biz = (await createTestBusiness(owner.accessToken!)) as { id: string };
    businessId = biz.id;

    const svc = (await createTestService(owner.accessToken!, businessId)) as { id: string };
    serviceId = svc.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ── Slots ─────────────────────────────────────────────────────────────────

  describe('Slot Management', () => {
    it('should create a slot as business owner', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const endTime = new Date(tomorrow);
      endTime.setMinutes(endTime.getMinutes() + 30);

      const res = await api
        .post(`${API_PREFIX}/slots`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          businessId,
          serviceId,
          startTime: tomorrow.toISOString(),
          endTime: endTime.toISOString(),
          price: 25.0,
          capacity: 2,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      slotId = res.body.data.id;
    });

    it('should reject slot creation by customer', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      tomorrow.setHours(14, 0, 0, 0);
      const endTime = new Date(tomorrow);
      endTime.setMinutes(endTime.getMinutes() + 30);

      const res = await api
        .post(`${API_PREFIX}/slots`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          businessId,
          serviceId,
          startTime: tomorrow.toISOString(),
          endTime: endTime.toISOString(),
          price: 25.0,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should get available slots (public endpoint)', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await api
        .get(`${API_PREFIX}/slots/available?businessId=${businessId}&date=${dateStr}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should list slots as business owner', async () => {
      const res = await api
        .get(`${API_PREFIX}/slots?businessId=${businessId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should get a slot by ID', async () => {
      if (!slotId) return;

      const res = await api
        .get(`${API_PREFIX}/slots/${slotId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(slotId);
    });

    it('should update a slot', async () => {
      if (!slotId) return;

      const res = await api
        .put(`${API_PREFIX}/slots/${slotId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ price: 30.0 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should bulk create slots', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 8);

      const res = await api
        .post(`${API_PREFIX}/slots/bulk`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          businessId,
          serviceId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          timeSlots: [
            { startTime: '09:00', endTime: '09:30' },
            { startTime: '09:30', endTime: '10:00' },
          ],
          daysOfWeek: [1, 2, 3, 4, 5],
          price: 20.0,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });

  // ── Bookings ──────────────────────────────────────────────────────────────

  describe('Booking Lifecycle', () => {
    let bookingSlotId: string;

    beforeAll(async () => {
      // Create a fresh slot specifically for booking tests
      const slot = (await createTestSlot(owner.accessToken!, businessId, serviceId)) as {
        id: string;
      };
      bookingSlotId = slot.id;
    });

    it('should create a booking as customer', async () => {
      const res = await api
        .post(`${API_PREFIX}/bookings`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          slotId: bookingSlotId,
          numberOfPeople: 1,
          notes: 'Integration test booking',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('pending');
      bookingId = res.body.data.id;
    });

    it('should get booking by ID', async () => {
      if (!bookingId) return;

      const res = await api
        .get(`${API_PREFIX}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(bookingId);
    });

    it('should list bookings for user', async () => {
      const res = await api
        .get(`${API_PREFIX}/bookings`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should confirm booking as business owner', async () => {
      if (!bookingId) return;

      const res = await api
        .post(`${API_PREFIX}/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('should reject confirm by customer', async () => {
      if (!bookingId) return;

      // Create another booking to test confirm rejection
      const slot2 = (await createTestSlot(owner.accessToken!, businessId, serviceId)) as {
        id: string;
      };
      const bookRes = await api
        .post(`${API_PREFIX}/bookings`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ slotId: slot2.id })
        .expect(201);

      const res = await api
        .post(`${API_PREFIX}/bookings/${bookRes.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should complete a confirmed booking', async () => {
      if (!bookingId) return;

      const res = await api
        .post(`${API_PREFIX}/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });

    it('should cancel a booking with reason', async () => {
      // Create a new booking to cancel
      const slot3 = (await createTestSlot(owner.accessToken!, businessId, serviceId)) as {
        id: string;
      };

      const bookRes = await api
        .post(`${API_PREFIX}/bookings`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ slotId: slot3.id })
        .expect(201);

      const res = await api
        .post(`${API_PREFIX}/bookings/${bookRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should filter bookings by status', async () => {
      const res = await api
        .get(`${API_PREFIX}/bookings?status=completed`)
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data.every((b: { status: string }) => b.status === 'completed')).toBe(true);
      }
    });

    it('should reject booking without auth', async () => {
      await api.post(`${API_PREFIX}/bookings`).send({ slotId: bookingSlotId }).expect(401);
    });
  });
});
