/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../setup/test-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /health — returns 200 with ok status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.status).toMatch(/^(ok|degraded)$/);
    expect(res.body.services).toBeDefined();
    expect(res.body.services.database).toBeDefined();
    expect(res.body.services.redis).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /health — does not expose secrets or internal config', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('secret');
    expect(body).not.toContain('password');
    expect(body).not.toContain('DATABASE_URL');
  });

  it('GET /health — no auth required (public endpoint)', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('GET /health — platform metadata is correct', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.platform?.phonePrefix).toBe('+972');
    expect(res.body.platform?.currency).toMatch(/ILS/);
  });

  it('GET /health — database connection reports ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.services.database).toBe('ok');
  });
});
