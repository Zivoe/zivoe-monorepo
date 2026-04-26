import 'server-only';

import { PayloadSDK } from '@payloadcms/sdk';

import type { Config } from '@zivoe/cms-types/payload-types';

import { env } from '@/env';

const globalForCms = globalThis as unknown as {
  insightsCmsClient: PayloadSDK<Config> | undefined;
};

export function getInsightsCmsOrigin() {
  return env.NEXT_PUBLIC_INSIGHTS_CMS_URL.replace(/\/$/, '');
}

function getCmsApiBaseUrl() {
  return `${getInsightsCmsOrigin()}/api`;
}

function createCmsHeaders(preview: boolean) {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (preview) {
    headers['x-preview-secret'] = env.INSIGHTS_PREVIEW_SECRET;
  }

  return headers;
}

const cmsClient =
  globalForCms.insightsCmsClient ??
  new PayloadSDK<Config>({
    baseURL: getCmsApiBaseUrl()
  });

if (env.NODE_ENV !== 'production') globalForCms.insightsCmsClient = cmsClient;

export function getCms() {
  return cmsClient;
}

export function getCmsRequestInit(preview: boolean): RequestInit {
  return {
    headers: createCmsHeaders(preview)
  };
}
