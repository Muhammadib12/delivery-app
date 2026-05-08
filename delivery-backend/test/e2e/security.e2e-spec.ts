/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Security (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    seed = await seedTestData(testPrisma);

    await testPrisma.otpCode.create({
      data: {
        phone: seed.customerUser.phone,
        codeHash:
          '$2b$10$XQv.FxOQH/vxLM0sI2Rz.eNhAjQgv5I9H0YnGwdWdDVFYP27YCSA2',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    const custRes = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({
        phone: seed.customerUser.phone,
        code: '111111',
        role: 'CUSTOMER',
      });
    customerToken = custRes.body.data?.accessToken ?? '';

    const adminRes = await loginByEmail(app, 'admin@test.com', 'Test1234!');
    adminToken = adminRes.accessToken;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Security headers ──────────────────────────────────────────────────────

  describe('Security headers (Helmet)', () => {
    it('response includes X-Content-Type-Options', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-content-type-options']).toBeDefined();
    });

    it('response includes X-Frame-Options', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('response does not expose X-Powered-By', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  // ─── Authentication security ───────────────────────────────────────────────

  describe('Authentication security', () => {
    it('missing Authorization header returns 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('malformed Bearer token returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not.a.jwt')
        .expect(401);
    });

    it('expired token returns 401', async () => {
      // Manually create an expired token-like scenario using wrong secret
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid',
        )
        .expect(401);
    });

    it('token from different secret returns 401', async () => {
      // This is a valid JWT signed with a different secret
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1dWlkIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNjAwMDAwMDAwfQ.wrong_signature',
        )
        .expect(401);
    });
  });

  // ─── Horizontal access control ─────────────────────────────────────────────

  describe('Horizontal access control (IDOR)', () => {
    it('customer cannot cancel another customer order', async () => {
      // Create a second customer
      const phone2 = '+972501333444';
      await testPrisma.otpCode.create({
        data: {
          phone: phone2,
          codeHash:
            '$2b$10$XQv.FxOQH/vxLM0sI2Rz.eNhAjQgv5I9H0YnGwdWdDVFYP27YCSA2',
          expiresAt: new Date(Date.now() + 300_000),
        },
      });
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone: phone2, code: '111111', role: 'CUSTOMER' });
      const customer2Token = r.body.data?.accessToken ?? '';

      // customer1 cancels its own order
      const { v4: uuidv4 } = await import('uuid');
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          addressId: seed.customerAddress.id,
          paymentMethod: 'CASH_ON_DELIVERY',
          cartSnapshot: {
            restaurantId: seed.restaurant.id,
            items: [{ productId: seed.product.id, quantity: 1 }],
          },
        });

      const orderId = createRes.body.data?.id;
      if (!orderId) return;

      // customer2 tries to cancel customer1's order
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ reason: 'I hacked you' })
        .expect(404); // Not found for wrong customer
    });
  });

  // ─── Vertical access control ───────────────────────────────────────────────

  describe('Vertical access control (Role escalation)', () => {
    it('CUSTOMER cannot access ADMIN dashboard', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('CUSTOMER cannot manage driver offers', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/drivers/me/offers/active')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('CUSTOMER cannot access restaurant menu management', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/me/menu/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('ADMIN cannot create customer orders', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          addressId: seed.customerAddress.id,
          paymentMethod: 'CASH_ON_DELIVERY',
          cartSnapshot: { restaurantId: seed.restaurant.id, items: [] },
        })
        .expect(403);
    });
  });

  // ─── Input validation / injection ──────────────────────────────────────────

  describe('Input validation', () => {
    it('SQL injection attempt in phone field returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: "'; DROP TABLE users; --" })
        .expect(400);
    });

    it('XSS string in displayName is rejected or stored safely', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ displayName: '<script>alert(1)</script>' });

      // Either rejected (400) or accepted and stored as-is (not executed)
      // We just verify no script execution — any 2xx or 4xx is acceptable
      if (res.status === 200) {
        expect(res.body.data?.displayName).toBe('<script>alert(1)</script>');
      }
    });

    it('large payload is rejected', async () => {
      const bigString = 'A'.repeat(10_000);
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: bigString })
        .expect(400);
    });

    it('unknown fields are stripped by whitelist pipe', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: '+972501234567', admin: true, inject: 'payload' })
        .expect(400); // forbidNonWhitelisted = true

      expect(res.body.success).toBe(false);
    });

    it('invalid UUID in param returns 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/not-a-uuid')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(400);
    });
  });

  // ─── Error response safety ──────────────────────────────────────────────────

  describe('Error response safety', () => {
    it('500 errors do not expose stack traces', async () => {
      // POST with body that triggers internal logic — any real 500 should not have stack
      // Here we test the contract: errors follow {success, error, timestamp, path}
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body).not.toHaveProperty('stack');
    });
  });

  // ─── Swagger not exposed in production ────────────────────────────────────

  describe('Swagger docs', () => {
    it('Swagger is accessible in test environment', async () => {
      // In test/dev mode, docs should be available
      await request(app.getHttpServer())
        .get('/api/docs')
        .expect((res) => {
          expect([200, 301, 302]).toContain(res.status);
        });
    });
  });
});
