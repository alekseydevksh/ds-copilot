import { Module } from '@nestjs/common';
import { anthropicProvider } from './anthropic.provider';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [anthropicProvider, ChatService],
})
export class ChatModule {}
