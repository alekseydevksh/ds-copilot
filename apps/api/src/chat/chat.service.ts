import Anthropic from '@anthropic-ai/sdk';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { ANTHROPIC_CLIENT } from './anthropic.provider';
import type { ChatMessage } from './chat.schema';

const SYSTEM_PROMPT =
  'You are an assistant for developers who work with a design system. ' +
  'Answer briefly and precisely. If you are not sure, say so.';

const MAX_TOKENS = 1024;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async reply(message: string): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: this.config.get('ANTHROPIC_MODEL', { infer: true }),
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      });
      return response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');
    } catch (error) {
      // Log the details on the server, return a generic message to the client.
      this.logger.error(error instanceof Error ? error.message : String(error));
      throw new BadGatewayException('The language model request failed');
    }
  }

  /**
   * Streams the reply as text chunks. Aborting the signal cancels the upstream request.
   * Failures are logged here and rethrown to the caller.
   */
  async *streamReply(
    messages: ChatMessage[],
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    try {
      const stream = this.anthropic.messages.stream(
        {
          model: this.config.get('ANTHROPIC_MODEL', { infer: true }),
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages,
        },
        { signal },
      );
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        this.logger.error(
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
  }
}
