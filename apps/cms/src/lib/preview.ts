import crypto from 'node:crypto';

import { env } from '@/env';

const PREVIEW_TTL_SECONDS = 60 * 30;

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, '');

const createPreviewSignature = ({ expires, slug }: { expires: string; slug: string }) =>
  crypto.createHmac('sha256', env.INSIGHTS_PREVIEW_SECRET).update(`${slug}:${expires}`).digest('hex');

export const buildInsightsPreviewUrl = (slug?: null | string) => {
  if (!slug) return null;

  const expires = `${Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS}`;
  const signature = createPreviewSignature({ expires, slug });
  const params = new URLSearchParams({ expires, signature, slug });

  return `${normalizeBaseUrl(env.LANDING_PREVIEW_URL)}/api/preview/insights?${params.toString()}`;
};
