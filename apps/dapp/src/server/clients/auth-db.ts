import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import { env } from '@/env';

import * as schema from '../db/schema';

const globalForDb = globalThis as unknown as {
  client: Sql | undefined;
};

const client = globalForDb.client ?? postgres(env.AUTH_DATABASE_URL, { prepare: false });
if (env.NODE_ENV !== 'production') globalForDb.client = client;

export const authDb = drizzle(client, { schema });
export type AuthDb = typeof authDb;
