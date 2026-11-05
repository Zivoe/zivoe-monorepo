import 'server-only';

import { type Address } from 'viem';
import { z } from 'zod';

import { isSafelistedAddress } from '@/server/data/safelist';

import { env } from '@/env';

const CHAINALYSIS_BASE_URL = 'https://api.chainalysis.com/api/risk/v2/entities/';

/** Past this, a screen counts as not answered: every caller fails open, so a hung Chainalysis must not hold a page or a write. */
const TIMEOUT_MS = 10_000;

const assessmentSchema = z.object({
  address: z.string(),
  risk: z.enum(['Severe', 'High', 'Medium', 'Low']),
  riskReason: z.string().nullable()
});

export type ChainalysisAssessment = z.infer<typeof assessmentSchema>;

async function fetchAssessment({ address }: { address: Address }) {
  const response = await fetch(CHAINALYSIS_BASE_URL + address, {
    headers: {
      Accept: 'application/json',
      Token: env.CHAINALYSIS_API_KEY
    },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) {
    const responseBody = await response.text();
    const errorDetails = responseBody.trim() || response.statusText;
    throw new Error(`Chainalysis fetch failed (${response.status}): ${errorDetails}`);
  }

  const data: unknown = await response.json();
  const parsedData = assessmentSchema.safeParse(data);

  if (!parsedData.success) {
    throw new Error('Unexpected risk assessment data shape!');
  }

  return parsedData.data;
}

/**
 * Safelist first, then Chainalysis. Rejects when the screen cannot be made
 * (an error, a bad shape, or past `TIMEOUT_MS`); the caller decides what an
 * unanswered screen means — every one today lets the address through.
 */
export async function getChainalysisAssessment({ address }: { address: Address }) {
  const isOnSafeList = await isSafelistedAddress(address);

  if (isOnSafeList) {
    return { address, risk: 'Low', riskReason: null } satisfies ChainalysisAssessment;
  }

  return fetchAssessment({ address });
}
