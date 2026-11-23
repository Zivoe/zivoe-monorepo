'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

import { agreementAcceptance } from '@zivoe/database/schema';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { getRequiredStep } from '@/server/data/auth';
import { organizations } from '@/server/organizations';
import { isKycEnabled } from '@/server/verification/kyc-flag';
import { whileNotStarting } from '@/server/verification/start-lock';

export type AcceptAgreementsResult = { ok: true } | { ok: false; code: 'unauthorized' | 'not_member' | 'failed' };

/**
 * The Agreements step's Continue: records that `subjectId` (the person themselves, or an organization they
 * belong to) accepted the agreements, and who accepted. Behind the same lines as the page: a session,
 * the `kyc` flag, onboarding and the current terms. The first acceptance stands; a repeat changes nothing.
 */
export async function acceptAgreements(input: { subjectId: string }): Promise<AcceptAgreementsResult> {
  const subjectId = z.string().uuid().safeParse(input.subjectId);
  if (!subjectId.success) return { ok: false, code: 'failed' };

  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.id) return { ok: false, code: 'unauthorized' };
  if (!(await isKycEnabled({ user }))) return { ok: false, code: 'unauthorized' };
  if (await getRequiredStep(user.id)) return { ok: false, code: 'unauthorized' };
  // Under the subject's start lock, which leaving and removal take too: nobody leaves between the membership
  // check and the row that names them. `null` while a start or a membership change holds it: try again.
  const result = await whileNotStarting(subjectId.data, async () => {
    if (!(await organizations.canActForSubject({ userId: user.id, subjectId: subjectId.data }))) {
      return 'not_member' as const;
    }
    await db
      .insert(agreementAcceptance)
      .values({ subjectId: subjectId.data, acceptedByUserId: user.id })
      .onConflictDoNothing({ target: agreementAcceptance.subjectId });
    return 'accepted' as const;
  }).catch((error: unknown) => {
    Sentry.captureException(error, {
      tags: { source: 'SERVER', flow: 'accept-agreements' },
      extra: { subjectId: subjectId.data }
    });
    return 'failed' as const;
  });
  if (result === 'not_member') return { ok: false, code: 'not_member' };
  if (result !== 'accepted') return { ok: false, code: 'failed' };

  // The next step reads the acceptance: the router's earlier copy of the page must not send them back here.
  revalidatePath('/verification');
  return { ok: true };
}
