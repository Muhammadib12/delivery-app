/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Notifications (e2e)', () => {
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

  describe('POST /api/v1/notifications/device-token', () => {
    it('customer can register FCM token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fcmToken: 'test-notification-token-123', platform: 'android' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('invalid platform is rejected', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fcmToken: 'token-abc', platform: 'windows-phone' })
        .expect(400);
    });

    it('duplicate token upsert works', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fcmToken: 'dup-token-xyz', platform: 'android' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fcmToken: 'dup-token-xyz', platform: 'ios' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/device-token')
        .send({ fcmToken: 'token', platform: 'android' })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/notifications/device-token', () => {
    it('customer can remove own FCM token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fcmToken: 'token-to-delete', platform: 'android' });

      const res = await request(app.getHttpServer())
        .delete('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fcmToken: 'token-to-delete' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/notifications/device-token')
        .send({ fcmToken: 'some-token' })
        .expect(401);
    });
  });
});
