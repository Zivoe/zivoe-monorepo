import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';

import { env } from '@/env';

const shouldRevalidateInsights = (doc: Record<string, unknown> | null | undefined) =>
  !('_status' in (doc ?? {})) || doc?._status === 'published';

async function triggerLandingRevalidation() {
  const response = await fetch(env.LANDING_REVALIDATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.LANDING_REVALIDATE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Landing revalidation failed with status ${response.status}`);
  }
}

export const revalidateInsightsAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (!shouldRevalidateInsights(doc) && !shouldRevalidateInsights(previousDoc)) {
    return doc;
  }

  try {
    await triggerLandingRevalidation();
  } catch (error) {
    req.payload.logger.error({ error }, 'Failed to revalidate landing insights content');
  }

  return doc;
};

export const revalidateInsightsAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (!shouldRevalidateInsights(doc)) {
    return doc;
  }

  try {
    await triggerLandingRevalidation();
  } catch (error) {
    req.payload.logger.error({ error }, 'Failed to revalidate landing insights content after delete');
  }

  return doc;
};
