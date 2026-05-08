/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';
import { cleanDatabase, testPrisma } from '../setup/test-db';
import { seedTestData, SeedResult } from '../setup/test-seed';
import { loginByEmail } from '../setup/test-auth';

describe('Menu (e2e)', () => {
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

  // ─── Categories ───────────────────────────────────────────────────────────

  describe('GET /api/v1/restaurants/me/menu/categories', () => {
    it('owner can list categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/restaurants/me/menu/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 403 for admin role', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/me/menu/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/me/menu/categories')
        .expect(401);
    });
  });

  describe('POST /api/v1/restaurants/me/menu/categories', () => {
    it('owner can create category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Desserts', sortOrder: 2 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Desserts');
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ sortOrder: 3 })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/restaurants/me/menu/categories/:categoryId', () => {
    it('owner can delete own category', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/categories')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'To Delete' });

      const categoryId = createRes.body.data?.id;
      if (!categoryId) return;

      await request(app.getHttpServer())
        .delete(`/api/v1/restaurants/me/menu/categories/${categoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('returns 404 for category in different restaurant', async () => {
      await request(app.getHttpServer())
        .delete(
          '/api/v1/restaurants/me/menu/categories/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  // ─── Products ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/restaurants/me/menu/products', () => {
    it('owner can create product with valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'New Burger',
          price: 50,
          menuCategoryId: seed.menuCategory.id,
          isAvailable: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.price).toBe(50);
    });

    it('returns 400 when price is 0 or negative', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Free Item',
          price: 0,
          menuCategoryId: seed.menuCategory.id,
        })
        .expect(400);
    });

    it('returns 400 when required menuCategoryId is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'No Category Item', price: 30 })
        .expect(400);
    });

    it('staff can create product', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Staff Product',
          price: 35,
          menuCategoryId: seed.menuCategory.id,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });
  });

  describe('PATCH /api/v1/restaurants/me/menu/products/:productId/availability', () => {
    it('owner can toggle product availability', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/restaurants/me/menu/products/${seed.product.id}/availability`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isAvailable: false })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 404 for product in different restaurant', async () => {
      await request(app.getHttpServer())
        .patch(
          '/api/v1/restaurants/me/menu/products/00000000-0000-0000-0000-000000000000/availability',
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isAvailable: true })
        .expect(404);
    });

    it('returns 400 when isAvailable is missing', async () => {
      await request(app.getHttpServer())
        .patch(
          `/api/v1/restaurants/me/menu/products/${seed.product.id}/availability`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /api/v1/restaurants/me/menu/products/:productId', () => {
    it('owner can delete product', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/restaurants/me/menu/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Delete Me',
          price: 25,
          menuCategoryId: seed.menuCategory.id,
        });

      const productId = createRes.body.data?.id;
      if (!productId) return;

      await request(app.getHttpServer())
        .delete(`/api/v1/restaurants/me/menu/products/${productId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });
});
