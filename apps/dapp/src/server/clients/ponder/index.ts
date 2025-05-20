import { cache } from 'react';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import postgres from 'postgres';

import { Network } from '@zivoe/contracts';

import { env } from '@/env';

import * as schema from './schema';

const globalForPonder = globalThis as unknown as {
  pool: Pool | undefined;
};

export const getPonder = cache((network: Network) => {
  let url = env.PONDER_MAINNET_DATABASE_URL;
  if (network === 'SEPOLIA') url = env.PONDER_SEPOLIA_DATABASE_URL;

  const pool = globalForPonder.pool ?? new Pool({ connectionString: env.PONDER_SEPOLIA_DATABASE_URL });
  if (env.NODE_ENV !== 'production') globalForPonder.pool = pool;

  return drizzle({ client: pool });
});
