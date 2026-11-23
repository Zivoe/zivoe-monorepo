import 'server-only';

import { eq } from 'drizzle-orm';

import { agreementAcceptance } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';

/**
 * When a Verification subject accepted the offering agreements, or null if it has not. Read by `/verification`
 * to place the Agreements step, and by `/api/kyc/start`, which starts no inquiry without it.
 */
export async function getAgreementAcceptance({
  subjectId
}: {
  subjectId: string;
}): Promise<{ acceptedAt: Date } | null> {
  const [row] = await db
    .select({ acceptedAt: agreementAcceptance.acceptedAt })
    .from(agreementAcceptance)
    .where(eq(agreementAcceptance.subjectId, subjectId))
    .limit(1);
  return row ?? null;
}
