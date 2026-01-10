import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle-auth',
  schema: './src/server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.AUTH_DATABASE_URL!
  },
  casing: 'snake_case'
});
