import { z } from 'zod';

export const MAX_USER_MESSAGE_LENGTH = 4000;
// Assistant messages come back in the history, and model replies are often longer than user input.
export const MAX_ASSISTANT_MESSAGE_LENGTH = 20000;
export const MAX_HISTORY_LENGTH = 50;

export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'message must not be empty')
    .max(MAX_USER_MESSAGE_LENGTH, 'message is too long'),
});

const userMessageSchema = z.object({
  role: z.literal('user'),
  content: z
    .string()
    .trim()
    .min(1, 'message content must not be empty')
    .max(MAX_USER_MESSAGE_LENGTH, 'user message is too long'),
});

const assistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z
    .string()
    .trim()
    .min(1, 'message content must not be empty')
    .max(MAX_ASSISTANT_MESSAGE_LENGTH, 'assistant message is too long'),
});

export const chatMessageSchema = z.discriminatedUnion('role', [
  userMessageSchema,
  assistantMessageSchema,
]);

export const chatStreamRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'messages must not be empty')
    .max(
      MAX_HISTORY_LENGTH,
      `messages must contain at most ${MAX_HISTORY_LENGTH} items`,
    )
    .refine((messages) => messages.at(-1)?.role === 'user', {
      message: 'the last message must be from the user',
    }),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
