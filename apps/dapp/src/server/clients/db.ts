import 'server-only';

import postgres, { type Sql } from 'postgres';

import { createDatabase } from '@zivoe/database';

import { env } from '@/env';

const globalForDatabase = globalThis as unknown as {
  databaseClient: Sql | undefined;
};

const client = globalForDatabase.databaseClient ?? postgres(env.DATABASE_URL, { prepare: false });
if (env.NODE_ENV !== 'production') globalForDatabase.databaseClient = client;

export const db = createDatabase(client);
export type Db = typeof db;
