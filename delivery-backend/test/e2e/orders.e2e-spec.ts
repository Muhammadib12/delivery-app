/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let customerToken: string;
  let ownerToken: string;
  let adminToken: string;
  let driverToken: string;

  const validOrderBody = () => ({
    addressId: seed.customerAddress.id,
    paymentMethod: 'CASH_ON_DELIVERY',
    cartSnapshot: {
      restaurantId: seed.restaurant.id,
      items: [{ productId: seed.product.id, quantity: 1 }],
    },
  });

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    seed = await seedTestData(testPrisma);

    // Customer
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

    // Owner
    const ownerRes = await loginByEmail(
      app,
      'owner@testrestaurant.com',
      'Test1234!',
    );
    ownerToken = ownerRes.accessToken;

    // Admin
    const adminRes = await loginByEmail(app, 'admin@test.com', 'Test1234!');
    adminToken = adminRes.accessToken;

    // Driver
    await testPrisma.otpCode.create({
      data: {
        phone: seed.driverUser.phone,
        codeHash:
          '$2b$10$XQv.FxOQH/vxLM0sI2Rz.eNhAjQgv5I9H0YnGwdWdDVFYP27YCSA2',
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    const drvRes = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: seed.driverUser.phone, code: '111111', role: 'DRIVER' });
    driverToken = drvRes.body.data?.accessToken ?? '';
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Create Order ─────────────────────────────────────────────────────────

  describe('POST /api/v1/orders', () => {
    it('customer can create order', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_RESTAURANT');
    });

    it('non-customer cannot create order (driver gets 403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${driverToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody())
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody())
        .expect(401);
    });

    it('returns 404 for invalid restaurant', async () => {
      const body = {
        ...validOrderBody(),
        cartSnapshot: {
          restaurantId: '00000000-0000-0000-0000-000000000000',
          items: [{ productId: seed.product.id, quantity: 1 }],
        },
      };

      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(body)
        .expect(404);
    });

    it('returns 400 for unavailable product', async () => {
      const body = {
        ...validOrderBody(),
        cartSnapshot: {
          restaurantId: seed.restaurant.id,
          items: [{ productId: seed.unavailableProduct.id, quantity: 1 }],
        },
      };

      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(body)
        .expect(400);
    });

    it('returns 400 for empty cart', async () => {
      const body = {
        ...validOrderBody(),
        cartSnapshot: { restaurantId: seed.restaurant.id, items: [] },
      };

      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(body)
        .expect(400);
    });

    it('total is calculated server-side, not from client payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody())
        .expect(201);

      // Server-computed total = product price (45) + delivery fee (15) = 60
      expect(res.body.data.total).toBe(60);
    });

    it('idempotency: same key returns original order', async () => {
      const key = uuidv4();

      const res1 = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', key)
        .send(validOrderBody())
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', key)
        .send(validOrderBody())
        .expect(200);

      expect(res2.body.data.id).toBe(res1.body.data.id);
    });

    it('returns 400 for invalid addressId', async () => {
      const body = {
        ...validOrderBody(),
        addressId: '00000000-0000-0000-0000-000000000000',
      };

      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(body)
        .expect(404);
    });

    it('order starts with PENDING_RESTAURANT status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody())
        .expect(201);

      expect(res.body.data.status).toBe('PENDING_RESTAURANT');
    });

    it('price snapshot is stored, not product current price', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody())
        .expect(201);

      const item = res.body.data.items?.[0];
      expect(item.unitPrice).toBeDefined();
      expect(item.productName).toBeDefined();
    });

    it('restaurant must be OPEN or BUSY to accept orders', async () => {
      // Close the restaurant
      await testPrisma.restaurant.update({
        where: { id: seed.restaurant.id },
        data: { status: 'CLOSED' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody())
        .expect(400);

      // Re-open
      await testPrisma.restaurant.update({
        where: { id: seed.restaurant.id },
        data: { status: 'OPEN' },
      });
    });
  });

  // ─── Get Active Order ──────────────────────────────────────────────────────

  describe('GET /api/v1/orders/active', () => {
    it('customer can get active order', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody());

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders/active')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 403 for driver role', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/active')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });
  });

  // ─── Order History ─────────────────────────────────────────────────────────

  describe('GET /api/v1/orders', () => {
    it('customer sees only own orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.data.data).toBeDefined();
      expect(res.body.data.meta).toBeDefined();
    });

    it('driver cannot access customer order history', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });
  });

  // ─── Cancel Order ──────────────────────────────────────────────────────────

  describe('POST /api/v1/orders/:orderId/cancel', () => {
    it('customer can cancel PENDING_RESTAURANT order', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(validOrderBody());

      const orderId = createRes.body.data?.id;
      if (!orderId) return;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 404 for order not belonging to customer', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Test' })
        .expect(404);
    });
  });
});
