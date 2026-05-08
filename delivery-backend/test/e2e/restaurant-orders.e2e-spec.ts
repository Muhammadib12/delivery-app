/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Restaurant Orders (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let customerToken: string;
  let ownerToken: string;
  let staffToken: string;
  let adminToken: string;

  async function createPendingOrder() {
    const res = await request(app.getHttpServer())
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
    return res.body.data?.id as string;
  }

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

    const ownerRes = await loginByEmail(
      app,
      'owner@testrestaurant.com',
      'Test1234!',
    );
    ownerToken = ownerRes.accessToken;

    const staffRes = await loginByEmail(
      app,
      'staff@testrestaurant.com',
      'Test1234!',
    );
    staffToken = staffRes.accessToken;

    const adminRes = await loginByEmail(app, 'admin@test.com', 'Test1234!');
    adminToken = adminRes.accessToken;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /api/v1/restaurants/me/orders', () => {
    it('owner sees only own restaurant orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurants/me/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeDefined();
    });

    it('customer cannot access restaurant orders', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/me/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/me/orders')
        .expect(401);
    });
  });

  describe('POST /api/v1/restaurants/me/orders/:orderId/accept', () => {
    it('owner can accept PENDING_RESTAURANT order', async () => {
      const orderId = await createPendingOrder();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ estimatedPrepMinutes: 20 })
        .expect(200);

      expect(res.body.data.status).toBe('ACCEPTED_BY_RESTAURANT');
    });

    it('cannot accept twice — invalid transition', async () => {
      const orderId = await createPendingOrder();

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ estimatedPrepMinutes: 20 });

      // Second accept should fail
      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ estimatedPrepMinutes: 20 })
        .expect(400);
    });

    it('customer cannot accept an order', async () => {
      const orderId = await createPendingOrder();

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ estimatedPrepMinutes: 15 })
        .expect(403);
    });
  });

  describe('POST /api/v1/restaurants/me/orders/:orderId/reject', () => {
    it('owner can reject PENDING_RESTAURANT order', async () => {
      const orderId = await createPendingOrder();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Out of stock' })
        .expect(200);

      expect(res.body.data.status).toBe('REJECTED_BY_RESTAURANT');
    });

    it('cannot reject after accept', async () => {
      const orderId = await createPendingOrder();

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ estimatedPrepMinutes: 15 });

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Too late' })
        .expect(400);
    });
  });

  describe('POST /api/v1/restaurants/me/orders/:orderId/preparing', () => {
    it('owner can mark order as PREPARING after accepting', async () => {
      const orderId = await createPendingOrder();

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ estimatedPrepMinutes: 15 });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/preparing`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('PREPARING');
    });

    it('cannot mark PREPARING on PENDING_RESTAURANT order', async () => {
      const orderId = await createPendingOrder();

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/preparing`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });
  });

  describe('POST /api/v1/restaurants/me/orders/:orderId/request-driver', () => {
    it('owner can request driver when order is ACCEPTED', async () => {
      const orderId = await createPendingOrder();

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ estimatedPrepMinutes: 15 });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/request-driver`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('LOOKING_FOR_DRIVER');
    });

    it('owner can request driver when order is PREPARING', async () => {
      const orderId = await createPendingOrder();

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ estimatedPrepMinutes: 15 });

      await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/preparing`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/restaurants/me/orders/${orderId}/request-driver`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('LOOKING_FOR_DRIVER');
    });
  });
});
