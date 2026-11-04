import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { ChatService } from './chat.service';

const chatRequestSchema = z.object({
  message: z.string().trim().min(1, 'message must not be empty').max(4000, 'message is too long'),
});

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async create(@Body() body: unknown): Promise<{ reply: string }> {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message));
    }
    return { reply: await this.chat.reply(parsed.data.message) };
  }
}
