/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let adminToken: string;
  let superAdminToken: string;
  let customerToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    seed = await seedTestData(testPrisma);

    const admin = await loginByEmail(app, 'admin@test.com', 'Test1234!');
    adminToken = admin.accessToken;

    const superAdmin = await loginByEmail(
      app,
      'superadmin@test.com',
      'Test1234!',
    );
    superAdminToken = superAdmin.accessToken;

    const owner = await loginByEmail(
      app,
      'owner@testrestaurant.com',
      'Test1234!',
    );
    ownerToken = owner.accessToken;

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

  // ─── RBAC: only ADMIN/SUPER_ADMIN can access ──────────────────────────────

  const adminEndpoints = [
    { method: 'GET', path: '/api/v1/admin/dashboard' },
    { method: 'GET', path: '/api/v1/admin/users' },
    { method: 'GET', path: '/api/v1/admin/drivers' },
    { method: 'GET', path: '/api/v1/admin/restaurants' },
    { method: 'GET', path: '/api/v1/admin/orders' },
    { method: 'GET', path: '/api/v1/admin/settings' },
  ];

  describe('Role-based access control', () => {
    for (const ep of adminEndpoints) {
      it(`${ep.method} ${ep.path} — returns 401 without auth`, async () => {
        const r = request(app.getHttpServer())[
          ep.method.toLowerCase() as 'get'
        ](ep.path);
        await r.expect(401);
      });

      it(`${ep.method} ${ep.path} — returns 403 for customer role`, async () => {
        const r = request(app.getHttpServer())
          [ep.method.toLowerCase() as 'get'](ep.path)
          .set('Authorization', `Bearer ${customerToken}`);
        await r.expect(403);
      });

      it(`${ep.method} ${ep.path} — returns 403 for restaurant owner role`, async () => {
        const r = request(app.getHttpServer())
          [ep.method.toLowerCase() as 'get'](ep.path)
          .set('Authorization', `Bearer ${ownerToken}`);
        await r.expect(403);
      });
    }
  });

  // ─── Dashboard ────────────────────────────────────────────────────────────

  describe('GET /api/v1/admin/dashboard', () => {
    it('admin can access dashboard', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.users).toBeDefined();
      expect(res.body.data.orders).toBeDefined();
      expect(res.body.data.drivers).toBeDefined();
      expect(res.body.data.restaurants).toBeDefined();
    });

    it('super admin can access dashboard', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
    });
  });

  // ─── Users ────────────────────────────────────────────────────────────────

  describe('GET /api/v1/admin/users', () => {
    it('admin can list users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('passwordHash is never returned in user list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/status', () => {
    it('admin can suspend a user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${seed.customerUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Restore
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${seed.customerUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });
    });

    it('returns 400 for invalid status value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${seed.customerUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DELETED' })
        .expect(400);
    });
  });

  // ─── Drivers ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/admin/drivers', () => {
    it('admin can list drivers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/drivers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('PATCH /api/v1/admin/drivers/:driverId/verification', () => {
    it('admin can approve a driver', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/drivers/${seed.driverProfile.id}/verification`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 400 for invalid verification status', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/drivers/${seed.driverProfile.id}/verification`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'MAYBE' })
        .expect(400);
    });
  });

  // ─── Restaurants ──────────────────────────────────────────────────────────

  describe('PATCH /api/v1/admin/restaurants/:restaurantId/status', () => {
    it('admin can change restaurant status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/restaurants/${seed.restaurant.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Restore
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/restaurants/${seed.restaurant.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'OPEN' });
    });
  });

  describe('PATCH /api/v1/admin/restaurants/:restaurantId/commission', () => {
    it('admin can update commission rate', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/restaurants/${seed.restaurant.id}/commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rate: 20 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('rejects commission rate above 100', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/restaurants/${seed.restaurant.id}/commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rate: 150 })
        .expect(400);
    });

    it('rejects negative commission rate', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/restaurants/${seed.restaurant.id}/commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rate: -5 })
        .expect(400);
    });
  });

  // ─── Settings ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/admin/settings', () => {
    it('admin can list platform settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('PATCH /api/v1/admin/settings/:key', () => {
    it('admin can update a platform setting', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/admin/settings/delivery_fee_cod')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '18' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('customer cannot update settings', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/admin/settings/delivery_fee_cod')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ value: '0' })
        .expect(403);
    });
  });
});
