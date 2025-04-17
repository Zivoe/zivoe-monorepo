import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URI: z.string(),
    NETWORK: z.enum(['MAINNET', 'SEPOLIA']),
    MAINNET_ALCHEMY_API_KEY: z.string(),
    SEPOLIA_ALCHEMY_API_KEY: z.string(),
    PONDER_MAINNET_DATABASE_URL: z.string(),
    PONDER_SEPOLIA_DATABASE_URL: z.string(),
    BEEHIIV_PUBLICATION_ID: z.string(),
    BEEHIIV_API_KEY: z.string()
  },

  client: {},

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URI: process.env.DATABASE_URI,
    NETWORK: process.env.NETWORK,
    MAINNET_ALCHEMY_API_KEY: process.env.MAINNET_ALCHEMY_API_KEY,
    SEPOLIA_ALCHEMY_API_KEY: process.env.SEPOLIA_ALCHEMY_API_KEY,
    PONDER_MAINNET_DATABASE_URL: process.env.PONDER_MAINNET_DATABASE_URL,
    PONDER_SEPOLIA_DATABASE_URL: process.env.PONDER_SEPOLIA_DATABASE_URL,
    BEEHIIV_PUBLICATION_ID: process.env.BEEHIIV_PUBLICATION_ID,
    BEEHIIV_API_KEY: process.env.BEEHIIV_API_KEY
  },

  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true
});
