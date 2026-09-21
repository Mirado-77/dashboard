import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // The web app proxies /api to this server, the client IP comes from it.
  app.set('trust proxy', 'loopback, uniquelocal');
  app.disable('x-powered-by');
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'about.json', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}

await bootstrap();
