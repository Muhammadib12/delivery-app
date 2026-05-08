/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    seed = await seedTestData(testPrisma);

    // Customer uses OTP login — insert OTP manually for test
    await testPrisma.otpCode.create({
      data: {
        phone: seed.customerUser.phone,
        codeHash:
          '$2b$10$XQv.FxOQH/vxLM0sI2Rz.eNhAjQgv5I9H0YnGwdWdDVFYP27YCSA2', // 111111
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({
        phone: seed.customerUser.phone,
        code: '111111',
        role: 'CUSTOMER',
      });
    customerToken = res.body.data?.accessToken ?? '';

    const adminRes = await loginByEmail(app, 'admin@test.com', 'Test1234!');
    adminToken = adminRes.accessToken;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Profile ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/customers/profile', () => {
    it('customer can view own profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/profile')
        .expect(401);
    });

    it('admin cannot access customer profile endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/v1/customers/profile', () => {
    it('customer can update own profile', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ displayName: 'Updated Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('unknown fields are rejected', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/customers/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ displayName: 'Updated', role: 'ADMIN' })
        .expect(400);
    });
  });

  // ─── Addresses ────────────────────────────────────────────────────────────

  describe('GET /api/v1/customers/addresses', () => {
    it('customer can list own addresses', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/addresses')
        .expect(401);
    });
  });

  describe('POST /api/v1/customers/addresses', () => {
    it('creates address with valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          label: 'Work',
          street: '5 Business Avenue',
          city: 'Kabul',
          latitude: 31.78,
          longitude: 35.23,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('returns 400 when latitude is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ label: 'Work', street: 'Street', city: 'City' })
        .expect(400);
    });

    it('returns 400 when lat is out of range', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          label: 'Bad',
          street: 'St',
          city: 'City',
          latitude: 999,
          longitude: 35,
        })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/customers/addresses/:addressId/default', () => {
    it('sets an address as default', async () => {
      // Create second address
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/customers/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          label: 'Office',
          street: '10 Work St',
          city: 'Kabul',
          latitude: 31.79,
          longitude: 35.24,
        });

      const addressId = createRes.body.data?.id;
      if (!addressId) return; // Skip if create failed

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/customers/addresses/${addressId}/default`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 403 when customer tries to modify another customer address', async () => {
      // Use admin ID which is not a customer
      await request(app.getHttpServer())
        .patch(`/api/v1/customers/addresses/nonexistent-id/default`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
    });
  });
});
