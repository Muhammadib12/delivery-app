/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Driver Delivery (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let customerToken: string;
  let ownerToken: string;
  let driverToken: string;

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

  // ─── Offer flow ────────────────────────────────────────────────────────────

  describe('GET /api/v1/drivers/me/offers/active', () => {
    it('driver can check for active offers (null when none)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/drivers/me/offers/active')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // No offer yet
      expect(res.body.data).toBeNull();
    });

    it('customer cannot access driver offers', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/drivers/me/offers/active')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/drivers/me/offers/:offerId/decline', () => {
    it('returns 200 (safe no-op) for non-existent offer', async () => {
      // declineOffer silently ignores unknown offers
      const res = await request(app.getHttpServer())
        .post(
          '/api/v1/drivers/me/offers/00000000-0000-0000-0000-000000000000/decline',
        )
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ─── Delivery transitions ─────────────────────────────────────────────────

  describe('Delivery lifecycle via manually seeded delivery', () => {
    let deliveryId: string;

    beforeAll(async () => {
      // Create a full order flow manually via DB to set up delivery state
      const order = await testPrisma.order.create({
        data: {
          customerId: seed.customerProfile.id,
          restaurantId: seed.restaurant.id,
          addressId: seed.customerAddress.id,
          addressSnapshot: {},
          status: 'DRIVER_ASSIGNED',
          subtotal: 45,
          deliveryFee: 15,
          total: 60,
          paymentMethod: 'CASH_ON_DELIVERY',
          idempotencyKey: uuidv4(),
          autoRejectAt: new Date(Date.now() + 180_000),
        },
      });

      const delivery = await testPrisma.delivery.create({
        data: {
          orderId: order.id,
          driverId: seed.driverProfile.id,
          status: 'DRIVER_ASSIGNED',
          assignedAt: new Date(),
        },
      });

      // Set driver as ON_DELIVERY
      await testPrisma.driverProfile.update({
        where: { id: seed.driverProfile.id },
        data: { availabilityStatus: 'ON_DELIVERY' },
      });

      deliveryId = delivery.id;
    });

    it('only assigned driver can update delivery', async () => {
      // Create a second driver
      const phone2 = '+972501555666';
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
        .send({ phone: phone2, code: '111111', role: 'DRIVER' });
      const otherDriverToken = r.body.data?.accessToken ?? '';

      await request(app.getHttpServer())
        .post(`/api/v1/drivers/me/deliveries/${deliveryId}/arrived-restaurant`)
        .set('Authorization', `Bearer ${otherDriverToken}`)
        .expect(403);
    });

    it('driver can mark arrived-restaurant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/me/deliveries/${deliveryId}/arrived-restaurant`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('DRIVER_ARRIVED_RESTAURANT');
    });

    it('cannot skip picked-up — must mark arrived-restaurant first', async () => {
      // Create a fresh delivery in DRIVER_ASSIGNED state
      const order2 = await testPrisma.order.create({
        data: {
          customerId: seed.customerProfile.id,
          restaurantId: seed.restaurant.id,
          addressId: seed.customerAddress.id,
          addressSnapshot: {},
          status: 'DRIVER_ASSIGNED',
          subtotal: 45,
          deliveryFee: 15,
          total: 60,
          paymentMethod: 'CASH_ON_DELIVERY',
          idempotencyKey: uuidv4(),
          autoRejectAt: new Date(Date.now() + 180_000),
        },
      });
      const delivery2 = await testPrisma.delivery.create({
        data: {
          orderId: order2.id,
          driverId: seed.driverProfile.id,
          status: 'DRIVER_ASSIGNED',
          assignedAt: new Date(),
        },
      });

      // Try to skip to picked-up without arrived-restaurant
      await request(app.getHttpServer())
        .post(`/api/v1/drivers/me/deliveries/${delivery2.id}/picked-up`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(400);
    });

    it('driver can mark picked-up after arrived-restaurant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/me/deliveries/${deliveryId}/picked-up`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('PICKED_UP');
    });

    it('driver can mark arrived-customer', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/me/deliveries/${deliveryId}/arrived-customer`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('ARRIVED_CUSTOMER');
    });

    it('driver can mark delivered', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/me/deliveries/${deliveryId}/delivered`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('DELIVERED');
    });

    it('driver is set ONLINE after delivery completion', async () => {
      const profile = await testPrisma.driverProfile.findUnique({
        where: { id: seed.driverProfile.id },
      });
      expect(profile?.availabilityStatus).toBe('ONLINE');
    });

    it('driver earning is recorded after delivery', async () => {
      const earning = await testPrisma.driverEarning.findFirst({
        where: { driverId: seed.driverProfile.id },
      });
      expect(earning).not.toBeNull();
      expect(Number(earning!.netAmount)).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/drivers/me/active-delivery', () => {
    it('returns 404 when no active delivery', async () => {
      // After completing delivery above, no active delivery
      await request(app.getHttpServer())
        .get('/api/v1/drivers/me/active-delivery')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(404);
    });

    it('customer cannot access driver active delivery', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/drivers/me/active-delivery')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/drivers/me/deliveries', () => {
    it('driver can view delivery history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/drivers/me/deliveries')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.data.data).toBeDefined();
      expect(res.body.data.meta).toBeDefined();
    });
  });
});
