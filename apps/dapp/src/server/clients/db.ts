import 'server-only';

import { cache } from 'react';

import { MongoClient, ServerApiVersion } from 'mongodb';

import { env } from '@/env.js';
import { type DailyData } from '@/types';

type SafelistEntry = {
  walletAddress: string;
};

const globalForDb = globalThis as unknown as {
  mongoClient: MongoClient | undefined;
};

const mongoClient =
  globalForDb.mongoClient ??
  new MongoClient(env.DATABASE_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  });

if (env.NODE_ENV !== 'production') globalForDb.mongoClient = mongoClient;

export const getDb = cache(() => {
  const zivoeDb = mongoClient.db('ZivoeMainnet');

  return {
    daily: zivoeDb.collection<DailyData>('Daily'),
    safelist: zivoeDb.collection<SafelistEntry>('Safelist')
  };
});

export type Db = ReturnType<typeof getDb>;
