import 'server-only';

import crypto from 'node:crypto';

import { draftMode } from 'next/headers';

import { env } from '@/env';

export type InsightsPreviewSession = {
  isEnabled: boolean;
};

function createInsightsPreviewLinkSignature({ expires, slug }: { expires: string; slug: string }) {
  return crypto.createHmac('sha256', env.INSIGHTS_PREVIEW_SECRET).update(`${slug}:${expires}`).digest('hex');
}

function isValidSignature(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isValidInsightsPreviewLink(args: { expires: string; signature: string; slug: string }) {
  return isValidSignature(createInsightsPreviewLinkSignature(args), args.signature);
}

// A valid signed preview link grants draft-mode access to every insights document, not just the one
// named in the link. Acceptable because preview links are only shared with trusted editors from the CMS.
export async function getInsightsPreviewSession(): Promise<InsightsPreviewSession> {
  const draft = await draftMode();
  return { isEnabled: draft.isEnabled };
}
