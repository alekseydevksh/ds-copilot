import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ZodType } from 'zod';
import { chatRequestSchema, chatStreamRequestSchema } from './chat.schema';
import { ChatService } from './chat.service';

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.issues.map((issue) => issue.message),
    );
  }
  return parsed.data;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // Non-streaming endpoint, convenient for curl.
  @Post()
  async create(@Body() body: unknown): Promise<{ reply: string }> {
    const { message } = parseBody(chatRequestSchema, body);
    return { reply: await this.chat.reply(message) };
  }

  /**
   * Streams the reply as server-sent events: `delta` (text chunk), `done`, `error`.
   * Problems detected before the first chunk (validation, upstream failure) use a plain
   * HTTP status. Once the stream has started, failures are sent as an `error` event.
   */
  @Post('stream')
  async stream(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const { messages } = parseBody(chatStreamRequestSchema, body);

    const abort = new AbortController();
    // Stop paying for tokens when the client goes away or presses "stop".
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    const chunks = this.chat.streamReply(messages, abort.signal);

    // Wait for the first chunk before sending headers, so that upstream failures
    // can still be reported with a proper status code.
    let first: IteratorResult<string>;
    try {
      first = await chunks.next();
    } catch {
      throw new BadGatewayException('The language model request failed');
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const send = (event: string, data: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      let current = first;
      while (!current.done) {
        send('delta', { text: current.value });
        current = await chunks.next();
      }
      send('done', {});
    } catch {
      if (!abort.signal.aborted) {
        send('error', { message: 'The language model request failed' });
      }
    } finally {
      res.end();
    }
  }
}
