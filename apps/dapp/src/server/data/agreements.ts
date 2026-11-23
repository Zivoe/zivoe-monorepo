import 'server-only';

import { eq } from 'drizzle-orm';

import { agreementAcceptance } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';

/**
 * Whether a Verification subject has accepted the agreements. Read by `/verification` to place the Agreements
 * step, and by `/api/kyc/start`, which starts no inquiry without it.
 */
export async function hasAcceptedAgreements({ subjectId }: { subjectId: string }): Promise<boolean> {
  const [row] = await db
    .select({ subjectId: agreementAcceptance.subjectId })
    .from(agreementAcceptance)
    .where(eq(agreementAcceptance.subjectId, subjectId))
    .limit(1);
  return !!row;
}
