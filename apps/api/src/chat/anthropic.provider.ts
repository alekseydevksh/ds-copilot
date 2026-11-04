import Anthropic from '@anthropic-ai/sdk';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

export const anthropicProvider: Provider = {
  provide: ANTHROPIC_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }) }),
};
