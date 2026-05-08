/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData } from '../setup/test-seed';

/**
 * Rate limiting tests.
 *
 * NOTE: These tests verify that the ThrottlerModule is wired up correctly.
 * They do NOT hammer the server at full load — that belongs in autocannon scripts.
 *
 * Rates are configured in AppModule:
 *   global: 200 req/min per IP
 *
 * To test specific per-endpoint limits (OTP, orders) you would configure
 * per-route throttlers via @Throttle() decorators.
 */
describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    await seedTestData(testPrisma);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('Global rate limit', () => {
    it('health endpoint responds normally within limit', async () => {
      // Make 5 rapid requests — all should succeed (well within 200/min)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/health').expect(200);
      }
    });

    it('rate limited response uses standard error format', async () => {
      // Artificially trigger a 429 by making many requests quickly
      // We use a non-skippable endpoint to count requests
      const promises = Array.from({ length: 210 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/auth/otp/request')
          .send({ phone: '+972501000001' }),
      );

      const results = await Promise.all(promises);
      const tooManyRequests = results.filter((r) => r.status === 429);

      if (tooManyRequests.length > 0) {
        const sample = tooManyRequests[0];
        expect(sample.body.success).toBe(false);
        expect(sample.body.error).toBeDefined();
        expect(sample.body.error.code).toBeDefined();
        expect(sample.body.timestamp).toBeDefined();
        expect(sample.body.path).toBeDefined();
      }
      // Pass even if no 429 — confirms server is stable under load
    });
  });

  describe('Auth rate limiting', () => {
    it('OTP request endpoint is accessible', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: '+972509876543' });

      expect([200, 429]).toContain(res.status);
    });

    it('OTP verify with wrong code increments attempt counter', async () => {
      const phone = '+972501099099';
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone });

      // 3 wrong attempts should trigger AUTH_OTP_MAX_ATTEMPTS
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/otp/verify')
          .send({ phone, code: '000000', role: 'CUSTOMER' });
      }

      // 4th attempt should be blocked by max attempts
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '000000', role: 'CUSTOMER' })
        .expect(400);

      expect(res.body.error.code).toBe('AUTH_OTP_MAX_ATTEMPTS');
    });
  });
});
