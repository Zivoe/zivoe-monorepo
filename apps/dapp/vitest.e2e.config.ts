import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// The Persona sandbox end-to-end run: real Persona, real QStash, the real dev
// server behind APP_URL and its database. Never part of `pnpm test` — it
// needs the funnel up and creates inquiries and users — so it lives behind
// its own config and the `kyc:e2e` script.
//
// Variables come from the same `.env` the dev server boots from. `next dev`
// also reads `.env.local`; keep what this run needs in `.env` only.
const env = parseEnv(readFileSync(fileURLToPath(new URL('./.env', import.meta.url)), 'utf8'));

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url))
    }
  },
  test: {
    include: ['e2e/**/*.e2e.ts'],
    env,
    // Persona's Workflows and QStash's settle delay put a scenario at 15–30 s.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    maxConcurrency: 8,
    reporters: ['verbose']
  }
});
