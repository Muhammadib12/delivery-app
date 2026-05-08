/* eslint-disable */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authenticates via OTP flow (mock SMS) and returns tokens.
 * Works only in test/development environment where SMS_PROVIDER=mock.
 */
export async function loginAsCustomer(
  app: INestApplication,
  phone = '+972501000001',
): Promise<AuthTokens> {
  await request(app.getHttpServer())
    .post('/api/v1/auth/otp/request')
    .send({ phone })
    .expect(200);

  // In mock mode the OTP is always 111111
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: '111111', role: 'CUSTOMER' })
    .expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

export async function loginAsDriver(
  app: INestApplication,
  phone = '+972501000002',
): Promise<AuthTokens> {
  await request(app.getHttpServer())
    .post('/api/v1/auth/otp/request')
    .send({ phone })
    .expect(200);

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: '111111', role: 'DRIVER' })
    .expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

/**
 * Email login — used for ADMIN, RESTAURANT_OWNER, RESTAURANT_STAFF.
 */
export async function loginByEmail(
  app: INestApplication,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

export function authHeader(tokens: AuthTokens) {
  return `Bearer ${tokens.accessToken}`;
}
