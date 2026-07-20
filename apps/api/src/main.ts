import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true lets webhook controllers read req.rawBody, needed for
  // Stripe/PayPal signature verification (which hashes the exact raw bytes —
  // the parsed/re-serialized JSON body would not match the signature).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Strip unknown fields, transform primitives, collect all errors before throwing.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
  console.log(`OmniPOS API running on http://localhost:${port}`);
}

bootstrap();
