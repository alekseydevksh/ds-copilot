import { index, pgTable, text, timestamp, unique, uuid, vector } from 'drizzle-orm/pg-core';

// Size of the embedding vectors. Must match the embedding model in use;
// changing it requires a new migration and re-embedding all chunks.
export const EMBEDDING_DIMENSIONS = 1024;

export type DocumentType = 'docs' | 'story' | 'types';
export type Channel = 'web' | 'telegram' | 'mcp';
export type MessageRole = 'user' | 'assistant';

// A source file or page of the design system documentation.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull().unique(),
  type: text('type').$type<DocumentType>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// A piece of a document. The embedding is nullable so chunks can be stored
// first and embedded in a separate step.
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    component: text('component'),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chunks_document_id_idx').on(table.documentId),
    index('chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

// One chat in one channel, for example a Telegram chat or a browser session.
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: text('channel').$type<Channel>().notNull(),
    externalChatId: text('external_chat_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('conversations_channel_chat_uq').on(table.channel, table.externalChatId)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_created_idx').on(table.conversationId, table.createdAt)],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
