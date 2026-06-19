import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import { env } from '@/env';

import * as schema from '../db/schema';

const globalForAuthDb = globalThis as unknown as {
  authDbClient: Sql | undefined;
};

const client = globalForAuthDb.authDbClient ?? postgres(env.AUTH_DATABASE_URL, { prepare: false });

if (env.NODE_ENV !== 'production') globalForAuthDb.authDbClient = client;

export const authDb = drizzle(client, { schema });
