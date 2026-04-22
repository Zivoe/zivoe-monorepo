import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    SERVER_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1),
    PAYLOAD_SECRET: z.string().min(1),
    INSIGHTS_PREVIEW_SECRET: z.string().min(1),
    LANDING_PREVIEW_URL: z.string().url(),
    LANDING_REVALIDATE_URL: z.string().url(),
    LANDING_REVALIDATE_API_KEY: z.string().min(1),
    VERCEL_URL: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_ENDPOINT: z.string().url(),
    R2_PUBLIC_URL: z.string().url()
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SERVER_URL: process.env.SERVER_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
    INSIGHTS_PREVIEW_SECRET: process.env.INSIGHTS_PREVIEW_SECRET,
    LANDING_PREVIEW_URL: process.env.LANDING_PREVIEW_URL,
    LANDING_REVALIDATE_URL: process.env.LANDING_REVALIDATE_URL,
    LANDING_REVALIDATE_API_KEY: process.env.LANDING_REVALIDATE_API_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL
  },
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true
});

export function getCmsServerUrl() {
  if (env.SERVER_URL) {
    return env.SERVER_URL;
  }

  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  throw new Error('SERVER_URL is required outside Vercel preview environments.');
}
