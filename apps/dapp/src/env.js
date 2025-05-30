import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URI: z.string(),
    PONDER_MAINNET_DATABASE_URL: z.string(),
    PONDER_SEPOLIA_DATABASE_URL: z.string(),
    QSTASH_CURRENT_SIGNING_KEY: z.string(),
    QSTASH_NEXT_SIGNING_KEY: z.string()
  },

  client: {
    NEXT_PUBLIC_DYNAMIC_ENV_ID: z.string(),
    NEXT_PUBLIC_NETWORK: z.enum(['MAINNET', 'SEPOLIA']),
    NEXT_PUBLIC_MAINNET_ALCHEMY_API_KEY: z.string(),
    NEXT_PUBLIC_SEPOLIA_ALCHEMY_API_KEY: z.string()
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URI: process.env.DATABASE_URI,
    NEXT_PUBLIC_MAINNET_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_MAINNET_ALCHEMY_API_KEY,
    NEXT_PUBLIC_SEPOLIA_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_SEPOLIA_ALCHEMY_API_KEY,
    PONDER_MAINNET_DATABASE_URL: process.env.PONDER_MAINNET_DATABASE_URL,
    PONDER_SEPOLIA_DATABASE_URL: process.env.PONDER_SEPOLIA_DATABASE_URL,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    NEXT_PUBLIC_DYNAMIC_ENV_ID: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK
  },

  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true
});
