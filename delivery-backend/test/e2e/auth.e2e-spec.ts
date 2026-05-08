/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData } from '../setup/test-seed';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    seed = await seedTestData(testPrisma);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── OTP Request ────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/otp/request', () => {
    it('returns 200 with valid +972 phone', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: '+972501234567' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
      expect(res.body.data.expiresInSeconds).toBe(300);
    });

    it('returns 400 with invalid phone format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: '0501234567' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBeDefined();
    });

    it('returns 400 when phone is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 with +964 (Iraq) phone — only +972 allowed', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: '+9647001234567' })
        .expect(400);
    });

    it('does not expose the OTP code in the response', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: '+972509999000' })
        .expect(200);

      expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);
    });
  });

  // ─── OTP Verify ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/otp/verify', () => {
    const phone = '+972501000011';

    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone });
    });

    it('returns tokens on correct OTP (mock code = 111111)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '111111', role: 'CUSTOMER' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.expiresIn).toBe(900);
      expect(res.body.data.user.role).toBe('CUSTOMER');
    });

    it('creates user if not exists (isNewUser = true)', async () => {
      const newPhone = '+972501111222';
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: newPhone });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone: newPhone, code: '111111', role: 'CUSTOMER' })
        .expect(200);

      expect(res.body.data.user.isNewUser).toBe(true);
    });

    it('existing user logs in without duplicate (isNewUser = false)', async () => {
      // First login
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone });
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '111111', role: 'CUSTOMER' });

      // Second login
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '111111', role: 'CUSTOMER' })
        .expect(200);

      expect(res.body.data.user.isNewUser).toBe(false);
    });

    it('returns 400 with wrong OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '000000', role: 'CUSTOMER' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AUTH_INVALID_OTP');
    });

    it('returns 400 when code is not 6 digits', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '123', role: 'CUSTOMER' })
        .expect(400);
    });

    it('returns 400 with invalid role', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '111111', role: 'ADMIN' })
        .expect(400);
    });

    it('response does not contain OTP hash or passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone, code: '111111', role: 'CUSTOMER' })
        .expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('codeHash');
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('tokenHash');
    });

    it('returns 403 for suspended user', async () => {
      const suspendedPhone = '+972509999111';
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: suspendedPhone });
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone: suspendedPhone, code: '111111', role: 'CUSTOMER' });

      // Suspend the user
      const user = await testPrisma.user.findFirst({
        where: { phone: suspendedPhone },
      });
      await testPrisma.user.update({
        where: { id: user!.id },
        data: { status: 'SUSPENDED' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: suspendedPhone });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone: suspendedPhone, code: '111111', role: 'CUSTOMER' })
        .expect(403);

      expect(res.body.error.code).toBe('USER_SUSPENDED');
    });
  });

  // ─── Email Login ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('admin can login with email/password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test1234!' })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    it('restaurant owner can login with email/password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'owner@testrestaurant.com', password: 'Test1234!' })
        .expect(200);

      expect(res.body.data.user.role).toBe('RESTAURANT_OWNER');
      expect(res.body.data.user.restaurantId).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'WrongPassword!' })
        .expect(401);

      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('returns 401 for unknown email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'Test1234!' })
        .expect(401);
    });

    it('response does not contain passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test1234!' })
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('returns 422 when body fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com' })
        .expect(400);
    });
  });

  // ─── Refresh Token ───────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    let tokens: { accessToken: string; refreshToken: string };

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test1234!' });
      tokens = res.body.data;
    });

    it('valid refresh token returns new access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.accessToken).not.toBe(tokens.accessToken);
    });

    it('old refresh token cannot be reused after rotation', async () => {
      // First refresh
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      // Try to reuse the original refresh token — should fail
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);

      expect(res2.body.error.code).toBe('AUTH_TOKEN_REVOKED');
    });

    it('invalid refresh token returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-valid-token' })
        .expect(401);
    });

    it('missing refreshToken field returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    let tokens: { accessToken: string; refreshToken: string };

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test1234!' });
      tokens = res.body.data;
    });

    it('logout succeeds with valid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('logout without access token returns 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('refresh token is revoked after logout', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);

      expect(res.body.error.code).toMatch(/TOKEN/);
    });
  });

  // ─── GET /me ─────────────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test1234!' });
      accessToken = res.body.data.accessToken;
    });

    it('returns user profile with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.role).toBe('ADMIN');
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns 401 with malformed token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(401);
    });

    it('response does not include passwordHash or tokenHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('tokenHash');
      expect(body).not.toContain('codeHash');
    });
  });

  // ─── Device Token ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/device-token', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Test1234!' });
      accessToken = res.body.data.accessToken;
    });

    it('registers FCM token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fcmToken: 'test-fcm-token-123', platform: 'android' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('upserts on duplicate token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fcmToken: 'duplicate-token', platform: 'android' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/device-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fcmToken: 'duplicate-token', platform: 'ios' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/device-token')
        .send({ fcmToken: 'test-token', platform: 'android' })
        .expect(401);
    });
  });

  // ─── Error format consistency ─────────────────────────────────────────────────

  describe('Error response format', () => {
    it('errors follow the standard format {success, error:{code,message}, timestamp, path}', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone: 'invalid' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBeDefined();
      expect(res.body.error.message).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.path).toBeDefined();
    });
  });
});
