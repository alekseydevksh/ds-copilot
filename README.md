# Design System Copilot

An AI assistant for developers who work with a design system. Ask a question in the browser and get the answer from Claude, streamed as it is generated.

## Features

- Web chat with streamed responses, a stop button, and conversation history kept in the browser.
- Accessible interface: labelled input, keyboard control, live region for replies, visible focus, loading and error states.
- HTTP API with a streaming chat endpoint (server-sent events) and a plain JSON endpoint that is handy for `curl`.
- PostgreSQL with pgvector, a Drizzle ORM schema and migrations.

## Tech stack

- Monorepo: Nx on Yarn 4 workspaces
- Web: Next.js (App Router), React, CSS Modules
- API: NestJS, Anthropic SDK, zod
- Database: PostgreSQL 17 with pgvector, Drizzle ORM
- Language: TypeScript

## Repository layout

| Path            | Description                                       |
| --------------- | ------------------------------------------------- |
| `apps/web`      | Next.js chat UI; proxies chat requests to the API |
| `apps/api`      | NestJS API: `/health`, `/chat`, `/chat/stream`    |
| `packages/db`   | Drizzle schema, migrations and database client    |
| `packages/core` | Shared package                                    |

## Getting started

Requirements: Node 24 (see `.nvmrc`), corepack, an Anthropic API key. Docker is only needed for the database.

```sh
nvm use
corepack enable
yarn install
cp .env.example .env   # then set ANTHROPIC_API_KEY
```

Run the API and the web app in two terminals:

```sh
yarn dev:api   # http://localhost:3001
yarn dev:web   # http://localhost:3000
```

Open http://localhost:3000 and send a message. The chat does not need the database.

To start Postgres and apply the migrations:

```sh
yarn db:up
yarn db:migrate
```

## Configuration

Settings are read from `.env` in the repository root and validated on startup (`apps/api/src/config/env.ts`).

| Variable            | Description                                         | Default                 |
| ------------------- | --------------------------------------------------- | ----------------------- |
| `ANTHROPIC_API_KEY` | Anthropic API key (required)                        |                         |
| `ANTHROPIC_MODEL`   | Claude model used for chat                          | `claude-sonnet-5-5`     |
| `API_PORT`          | Port of the API                                     | `3001`                  |
| `DATABASE_URL`      | Connection string, used by the database scripts     |                         |
| `API_URL`           | API address used by the web app's server-side proxy | `http://localhost:3001` |

Next.js reads env files from `apps/web`, so put an `API_URL` override in `apps/web/.env.local`.

## API

| Method | Path           | Description                                         |
| ------ | -------------- | --------------------------------------------------- |
| GET    | `/health`      | Returns `{ "status": "ok" }`                        |
| POST   | `/chat`        | `{ "message": "..." }` returns `{ "reply": "..." }` |
| POST   | `/chat/stream` | Streams the reply for a message history             |

`POST /chat/stream` takes the whole conversation on every request; the server stores nothing:

```sh
curl -N http://localhost:3001/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is a design token?"}]}'
```

The response is a stream of server-sent events:

- `delta` with `{ "text": "..." }`: a chunk of the reply
- `done`: the reply is complete
- `error` with `{ "message": "..." }`: the request failed after the stream started

Problems found before the first chunk (invalid input, upstream failure) are returned as regular HTTP errors: `400` for validation, `413` for a body over 256 KB, `502` when the model request fails. Limits: up to 50 messages, 4000 characters per user message, 20000 per assistant message, and the last message must come from the user.

## Development

```sh
yarn nx run-many -t lint typecheck build
```

CI runs the same targets with `nx affected`. Development uses a cheap model: set `ANTHROPIC_MODEL=claude-haiku-5-5` in `.env`.
