import 'server-only';

import { Collection, MongoClient, ServerApiVersion } from 'mongodb';

import type { Network } from '@zivoe/contracts';

import { env } from '@/env.js';
import { DailyData } from '@/types';

const globalForDb = globalThis as unknown as {
  mongoClient: MongoClient | undefined;
};

const mongoClient =
  globalForDb.mongoClient ??
  new MongoClient(env.DATABASE_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  });

if (env.NODE_ENV !== 'production') globalForDb.mongoClient = mongoClient;

export const getDb = ({ network }: { network: Network }) => {
  let zivoeDb = mongoClient.db('ZivoeMainnet');
  if (network === 'SEPOLIA') zivoeDb = mongoClient.db('ZivoeSepolia');

  return {
    daily: zivoeDb.collection('Daily') as Collection<DailyData>
  };
};

export type Db = ReturnType<typeof getDb>;
