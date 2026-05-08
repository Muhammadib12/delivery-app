/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Drivers (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let driverToken: string;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    seed = await seedTestData(testPrisma);

    // Driver OTP login
    await testPrisma.otpCode.create({
      data: {
        phone: seed.driverUser.phone,
        codeHash:
          '$2b$10$XQv.FxOQH/vxLM0sI2Rz.eNhAjQgv5I9H0YnGwdWdDVFYP27YCSA2',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    const driverRes = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: seed.driverUser.phone, code: '111111', role: 'DRIVER' });
    driverToken = driverRes.body.data?.accessToken ?? '';

    const adminRes = await loginByEmail(app, 'admin@test.com', 'Test1234!');
    adminToken = adminRes.accessToken;

    // Create customer for RBAC tests
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
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Profile ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/drivers/me', () => {
    it('driver can view own profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/drivers/me')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/drivers/me').expect(401);
    });

    it('customer cannot access driver profile endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/drivers/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/v1/drivers/me', () => {
    it('driver can update own profile', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/drivers/me')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ displayName: 'Updated Driver Name', vehicleType: 'car' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ─── Availability ──────────────────────────────────────────────────────────

  describe('PATCH /api/v1/drivers/me/availability', () => {
    it('approved driver can go ONLINE', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/availability')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'ONLINE' })
        .expect(200);

      expect(res.body.data.availabilityStatus).toBe('ONLINE');
    });

    it('approved driver can go OFFLINE', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/availability')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'OFFLINE' })
        .expect(200);

      expect(res.body.data.availabilityStatus).toBe('OFFLINE');
    });

    it('unapproved driver cannot go ONLINE', async () => {
      // Create unapproved driver
      const phone = '+972501777888';
      await testPrisma.otpCode.create({
        data: {
          phone,
          codeHash:
            '$2b$10$XQv.FxOQH/vxLM0sI2Rz.eNhAjQgv5I9H0YnGwdWdDVFYP27YCSA2',
          expiresAt: new Date(Date.now() + 300_000),
        },
      });
      const r = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '111111', role: 'DRIVER' });
      const newDriverToken = r.body.data?.accessToken ?? '';

      const res = await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/availability')
        .set('Authorization', `Bearer ${newDriverToken}`)
        .send({ status: 'ONLINE' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 with invalid status value', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/availability')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'FLYING' })
        .expect(400);
    });
  });

  // ─── Earnings ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/drivers/me/earnings', () => {
    it('driver can view own earnings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/drivers/me/earnings')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.data.totalEarnings).toBeDefined();
      expect(res.body.data.todayEarnings).toBeDefined();
    });

    it('customer cannot view driver earnings', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/drivers/me/earnings')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  // ─── Location update ───────────────────────────────────────────────────────

  describe('PATCH /api/v1/drivers/me/location', () => {
    it('driver can update location', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ latitude: 31.77, longitude: 35.22 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 400 when latitude is out of range', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ latitude: 999, longitude: 35.22 })
        .expect(400);
    });

    it('returns 400 when longitude is missing', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ latitude: 31.77 })
        .expect(400);
    });

    it('customer cannot update driver location', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/drivers/me/location')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ latitude: 31.77, longitude: 35.22 })
        .expect(403);
    });
  });
});
