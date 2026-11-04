import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import type { Env } from './config/env';

// Room for a full conversation history: up to 50 messages, assistant ones up to 20000 characters.
const BODY_LIMIT = '256kb';

async function bootstrap(): Promise<void> {
  // Body parsing is registered manually so that the size limit is explicit.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: BODY_LIMIT });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('API_PORT', { infer: true }));
}

void bootstrap();
