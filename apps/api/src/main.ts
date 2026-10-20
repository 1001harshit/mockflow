import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Be explicit about methods: the dashboard saves failure rules with PATCH and
  // removes webhooks with DELETE, and a preflight that doesn't list them gets
  // the request blocked by the browser before it is ever sent.
  //
  // Any origin is allowed on purpose: mocks are public URLs that users' own
  // frontends call from wherever they run. That's safe because auth travels in
  // the Authorization / x-api-key headers rather than cookies, so a foreign
  // page can't ride on a logged-in user's session.
  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-api-key'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port, '0.0.0.0');

  Logger.log(`MockFlow API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
