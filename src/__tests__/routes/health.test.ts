import { api } from '../helpers/test-helpers';

describe('Health & General — /health, 404', () => {
  describe('GET /health', () => {
    it('should return 200 with status OK', async () => {
      const res = await api.get('/health').expect(200);

      expect(res.body.status).toBe('OK');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status with DB checks', async () => {
      const res = await api.get('/health/ready');

      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('postgres');
      expect(res.body.checks).toHaveProperty('mongodb');
      expect(res.body.checks).toHaveProperty('redis');
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await api.get('/api/v1/nonexistent').expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for unknown API version', async () => {
      const res = await api.get('/api/v99/anything').expect(404);

      expect(res.body.success).toBe(false);
    });
  });
});
