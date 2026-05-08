import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.config.get<string>('redis.url') ?? 'redis://localhost:6379';
    this.client = new Redis(url);

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err: Error) =>
      this.logger.error('Redis error', err.message),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  // ─── Generic helpers ──────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // ─── Atomic lock (used by dispatch) ───────────────────────────────────────
  // Returns true if lock was acquired, false if already locked
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }

  // ─── Driver location cache ────────────────────────────────────────────────
  async setDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    ttlSeconds = 120,
  ): Promise<void> {
    const payload = JSON.stringify({
      lat,
      lng,
      updatedAt: new Date().toISOString(),
    });
    await this.set(`driver:${driverId}:location`, payload, ttlSeconds);
  }

  async getDriverLocation(
    driverId: string,
  ): Promise<{ lat: number; lng: number; updatedAt: string } | null> {
    const raw = await this.get(`driver:${driverId}:location`);
    if (!raw) return null;
    return JSON.parse(raw) as { lat: number; lng: number; updatedAt: string };
  }

  // ─── Idempotency keys ─────────────────────────────────────────────────────
  async setIdempotencyKey(
    key: string,
    orderId: string,
    ttlSeconds = 86400,
  ): Promise<void> {
    await this.set(`idempotency:${key}`, orderId, ttlSeconds);
  }

  async getIdempotencyKey(key: string): Promise<string | null> {
    return this.get(`idempotency:${key}`);
  }
}
