'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { agreementAcceptance } from '@zivoe/database/schema';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { getOnboardingStep } from '@/server/data/auth';
import { captureServerEvent } from '@/server/utils/analytics';

import { LATEST_AGREEMENTS_VERSION } from '@/lib/agreements';

export type AcceptAgreementsResult = { ok: true } | { ok: false; code: 'unauthorized' | 'outdated' | 'failed' };

/**
 * Records that the signed-in person accepted `version`, the agreements version the page showed them: for
 * themselves, which covers every account they act for. Called by `/verification`'s Agreements step and by
 * `/agreements`. Behind a session, the current terms and onboarding only: not the agreements gate, which this
 * action is the way through, nor the `kyc` flag, so nobody the gate holds can be stuck there. Refused as `outdated`
 * when a deploy moved `LATEST_AGREEMENTS_VERSION` on while the page was open, so a row never names a version other
 * than the one shown. A repeat (a double click, a second tab) succeeds without a second row or analytics event.
 */
export async function acceptAgreements({ version }: { version: string }): Promise<AcceptAgreementsResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return { ok: false, code: 'unauthorized' };
  if (await getOnboardingStep(userId)) return { ok: false, code: 'unauthorized' };
  if (version !== LATEST_AGREEMENTS_VERSION) return { ok: false, code: 'outdated' };

  try {
    const inserted = await db
      .insert(agreementAcceptance)
      .values({ userId, agreementsVersion: version })
      .onConflictDoNothing()
      .returning({ id: agreementAcceptance.id });
    // Nothing returned: the row was already there.
    if (inserted.length) {
      after(() =>
        captureServerEvent({
          distinctId: userId,
          event: 'agreements:accepted',
          properties: { agreements_version: version }
        })
      );
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'SERVER', flow: 'accept-agreements' },
      extra: { userId, version }
    });
    return { ok: false, code: 'failed' };
  }

  // No revalidation: both callers move on themselves (the step refreshes, `/agreements` loads the next page in full),
  // and a revalidated `/agreements` would redirect on its own as well.
  return { ok: true };
}
