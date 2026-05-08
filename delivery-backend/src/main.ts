import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // ─── Security headers ─────────────────────────────────────────────────────
  app.use(helmet());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  const rawOrigins = config.get<string[]>('app.corsOrigins') ?? [
    'http://localhost:3001',
  ];
  app.enableCors({ origin: rawOrigins, credentials: true });

  // ─── Global prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // ─── Validation pipe ──────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Global exception filter ──────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Global response transform ────────────────────────────────────────────
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // ─── Swagger ──────────────────────────────────────────────────────────────
  if (config.get<string>('app.env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Delivery Platform API')
      .setDescription(
        'Local delivery platform — Israel 🇮🇱 | Kabul / كابول | +972 | ILS ₪',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter your JWT access token (without Bearer prefix)',
          in: 'header',
        },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // يحفظ التوكن بعد refresh الصفحة
      },
    });
    logger.log('Swagger available at /api/docs');
  }

  // ─── Start ────────────────────────────────────────────────────────────────
  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
  logger.log(`Health check: http://localhost:${port}/health`);
}

void bootstrap();
