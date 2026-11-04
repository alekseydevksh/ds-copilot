import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// Load the repo-root .env when it exists. CI and production provide real environment variables.
try {
  process.loadEnvFile(resolve(process.cwd(), '../../.env'));
} catch {
  // No .env file: rely on the process environment.
}

// Development default matches docker-compose.yml.
const url =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/ds_copilot';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
});
