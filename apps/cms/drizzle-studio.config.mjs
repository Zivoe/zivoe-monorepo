import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'drizzle-kit';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

process.loadEnvFile(path.resolve(dirname, '.env'));

export default defineConfig({
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL
  }
});
