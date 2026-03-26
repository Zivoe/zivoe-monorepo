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

const assessmentRegistrationSchema = z.object({
  address: z.string()
});

type AssessmentRegistration = z.infer<typeof assessmentRegistrationSchema>;

async function fetchAssessment({ address }: { address: Address }) {
  const response = await fetch(CHAINALYSIS_BASE_URL + address, {
    headers: {
      'Content-Type': 'application/json',
      Token: env.CHAINALYSIS_API_KEY
    }
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Error fetching risk assessment!');
  }

  const data = await (response.json() as Promise<ChainalysisAssessment>);
  const parsedData = assessmentSchema.safeParse(data);

  if (!parsedData.success) {
    throw new Error('Unexpected risk assessment data shape!');
  }

  return parsedData.data;
}

async function registerAddress({ address }: { address: Address }) {
  const response = await fetch(CHAINALYSIS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Token: env.CHAINALYSIS_API_KEY
    },
    body: JSON.stringify({ address })
  });

  if (!response.ok) {
    throw new Error('Error registering address for risk assessment!');
  }

  const data = await (response.json() as Promise<AssessmentRegistration>);
  const parsedData = assessmentRegistrationSchema.safeParse(data);

  if (!parsedData.success) {
    throw new Error('Unexpected risk assessment registration response shape!');
  }

  if (parsedData.data.address !== address) {
    throw new Error('Risk assessment registration address is not matching!');
  }
}

export async function getChainalysisAssessment({ address }: { address: Address }) {
  const db = getDb();
  const isOnSafeList = await db.safelist.findOne({ walletAddress: getAddress(address) });

  if (isOnSafeList) {
    return { address, risk: 'Low', riskReason: null } satisfies ChainalysisAssessment;
  }

  let assessment = await fetchAssessment({ address });

  if (!assessment) {
    await registerAddress({ address });
    assessment = await fetchAssessment({ address });

    if (!assessment) {
      throw new Error('Error fetching risk assessment after registration!');
    }
  }

  return {
    address: assessment.address,
    risk: assessment.risk,
    riskReason: assessment.riskReason
  } satisfies ChainalysisAssessment;
}
