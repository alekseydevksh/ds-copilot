import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { ChatModule } from './chat/chat.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The app runs from apps/api, so the repository-root .env is two levels up.
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
