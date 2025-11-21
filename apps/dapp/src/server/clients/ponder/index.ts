import { cache } from 'react';

import { setDatabaseSchema } from '@ponder/client';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';

import { env } from '@/env';

import * as schema from './schema';

export type Ponder = NodePgDatabase<typeof schema>;

setDatabaseSchema(schema, 'indexer');

const globalForPonder = globalThis as unknown as {
  mainnetDb: Ponder | undefined;
};

const mainnetDb =
  globalForPonder.mainnetDb ?? drizzle(env.PONDER_MAINNET_DATABASE_URL, { schema, casing: 'snake_case' });

if (env.NODE_ENV !== 'production') {
  globalForPonder.mainnetDb = mainnetDb;
}

export const getPonder = cache(() => mainnetDb);
