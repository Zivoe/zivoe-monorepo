import 'server-only';

import { type Address, getAddress } from 'viem';
import { z } from 'zod';

import { getDb } from '@/server/clients/db';

import { env } from '@/env';

const CHAINALYSIS_BASE_URL = 'https://api.chainalysis.com/api/risk/v2/entities/';

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
    }
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

export async function getChainalysisAssessment({ address }: { address: Address }) {
  const db = getDb();
  const isOnSafeList = await db.safelist.findOne({ walletAddress: getAddress(address) });

  if (isOnSafeList) {
    return { address, risk: 'Low', riskReason: null } satisfies ChainalysisAssessment;
  }

  return fetchAssessment({ address });
}
