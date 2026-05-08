/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Restaurants (e2e)', () => {
  let app: INestApplication;
  let seed: SeedResult;
  let ownerToken: string;
  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDatabase();
    seed = await seedTestData(testPrisma);

    const owner = await loginByEmail(
      app,
      'owner@testrestaurant.com',
      'Test1234!',
    );
    ownerToken = owner.accessToken;

    const staff = await loginByEmail(
      app,
      'staff@testrestaurant.com',
      'Test1234!',
    );
    staffToken = staff.accessToken;

    const admin = await loginByEmail(app, 'admin@test.com', 'Test1234!');
    adminToken = admin.accessToken;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Public list ──────────────────────────────────────────────────────────

  describe('GET /api/v1/restaurants', () => {
    it('returns restaurant list without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurants')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('paginates results', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurants?page=1&limit=5')
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
    });

    it('filters by categoryId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/restaurants?categoryId=${seed.restaurantCategory.id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('does not expose commission rate or private fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurants')
        .expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('commissionRate');
    });
  });

  // ─── Public detail ────────────────────────────────────────────────────────

  describe('GET /api/v1/restaurants/:restaurantId', () => {
    it('returns restaurant detail without auth', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/restaurants/${seed.restaurant.id}`)
        .expect(200);

      expect(res.body.data.id).toBe(seed.restaurant.id);
      expect(res.body.data.name).toBe('Test Restaurant');
    });

    it('returns 404 for unknown restaurantId', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  // ─── Public menu ─────────────────────────────────────────────────────────

  describe('GET /api/v1/restaurants/:restaurantId/menu', () => {
    it('returns menu with categories and products', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/restaurants/${seed.restaurant.id}/menu`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('accessible without auth', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/restaurants/${seed.restaurant.id}/menu`)
        .expect(200);
    });
  });

  // ─── Owner: Get own restaurant ─────────────────────────────────────────────

  describe('GET /api/v1/restaurants/me', () => {
    it('owner can view own restaurant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurants/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(seed.restaurant.id);
    });

    it('staff can view own restaurant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurants/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/me')
        .expect(401);
    });

    it('returns 403 for admin role (wrong role)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  // ─── Owner: Update restaurant ──────────────────────────────────────────────

  describe('PUT /api/v1/restaurants/me', () => {
    it('owner can update restaurant details', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/restaurants/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Updated Restaurant Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('staff cannot update restaurant details', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/restaurants/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });

  // ─── Status update ────────────────────────────────────────────────────────

  describe('PATCH /api/v1/restaurants/me/status', () => {
    it('owner can change status to CLOSED', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/restaurants/me/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'CLOSED' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 400 for invalid status value', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/restaurants/me/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/restaurants/me/status')
        .send({ status: 'OPEN' })
        .expect(401);
    });
  });

  // ─── Restaurant categories (public) ────────────────────────────────────────

  describe('GET /api/v1/restaurant-categories', () => {
    it('returns categories without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurant-categories')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
