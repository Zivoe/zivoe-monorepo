import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { Network } from '@zivoe/contracts';

import { env } from '@/env';

import * as schema from './schema';

const globalForPonder = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

export const getPonder = ({ network }: { network: Network }) => {
  let url = env.PONDER_MAINNET_DATABASE_URL;
  if (network === 'SEPOLIA') url = env.PONDER_SEPOLIA_DATABASE_URL;

  const conn = globalForPonder.conn ?? postgres(url);
  if (env.NODE_ENV !== 'production') globalForPonder.conn = conn;

  return drizzle(conn, { schema });
};
