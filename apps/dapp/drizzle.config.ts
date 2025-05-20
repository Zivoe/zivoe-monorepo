import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/server/clients/ponder/schema.ts',
  dialect: 'postgresql'
});
