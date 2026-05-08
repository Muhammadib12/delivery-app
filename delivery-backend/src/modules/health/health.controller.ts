import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    let dbOk = false;
    let redisOk = false;

    try {
      await (this.prisma.$queryRaw`SELECT 1` as unknown as Promise<unknown>);
      dbOk = true;
    } catch {
      /* intentional — degraded mode */
    }

    try {
      await this.redis.set('health:ping', '1', 5);
      redisOk = true;
    } catch {
      /* intentional — degraded mode */
    }

    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'ok' : 'unreachable',
        redis: redisOk ? 'ok' : 'unreachable',
      },
      platform: {
        country: 'Israel',
        city: 'Kabul / كابول',
        phonePrefix: '+972',
        currency: 'ILS / ₪',
      },
    };
  }
}
