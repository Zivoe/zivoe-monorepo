import { defineConfig } from 'drizzle-kit';
import process from 'node:process';

try {
  process.loadEnvFile('.env');
} catch {
  // Drizzle will report a missing DATABASE_URL when a database command needs it.
}

export default defineConfig({
  out: './drizzle',
  schema: './src/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  casing: 'snake_case'
});
