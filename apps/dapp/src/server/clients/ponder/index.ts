import { cache } from 'react';

import { drizzle } from 'drizzle-orm/node-postgres';

import { Network } from '@zivoe/contracts';

import { env } from '@/env';

const globalForPonder = globalThis as unknown as {
  mainnetDb: ReturnType<typeof drizzle> | undefined;
  sepoliaDb: ReturnType<typeof drizzle> | undefined;
};

const mainnetDb = globalForPonder.mainnetDb ?? drizzle(env.PONDER_MAINNET_DATABASE_URL);
const sepoliaDb = globalForPonder.sepoliaDb ?? drizzle(env.PONDER_SEPOLIA_DATABASE_URL);

if (env.NODE_ENV !== 'production') {
  globalForPonder.mainnetDb = mainnetDb;
  globalForPonder.sepoliaDb = sepoliaDb;
}

export const getPonder = cache((network: Network) => {
  return network === 'SEPOLIA' ? sepoliaDb : mainnetDb;
});
