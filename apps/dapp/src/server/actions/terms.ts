'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { termsAcceptance } from '@zivoe/database/schema';
import { LATEST_LEGAL_DOCS_VERSION } from '@zivoe/ui/lib/legal-docs';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { captureServerEvent } from '@/server/utils/analytics';

import { handlePromise } from '@/lib/utils';

/**
 * Records that the signed-in user accepted `version`, the terms version `/terms` showed them. Refused with
 * `isOutdated` when a deploy moved `LATEST_LEGAL_DOCS_VERSION` on while the page was open, so a row never names
 * a version other than the one in force. Each acceptance is a new row.
 */
export async function acceptTerms({
  version
}: {
  version: string;
}): Promise<{ success?: true; error?: string; isOutdated?: true }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const userId = session.user.id;

  if (version !== LATEST_LEGAL_DOCS_VERSION) {
    return { error: 'The terms were updated while this page was open.', isOutdated: true };
  }

  const { err } = await handlePromise(db.insert(termsAcceptance).values({ userId, termsVersion: version }));

  if (err) {
    Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'accept-terms' }, extra: { userId, version } });
    return { error: 'Failed to save your acceptance. Please try again.' };
  }

  after(() =>
    captureServerEvent({ distinctId: userId, event: 'terms:accepted', properties: { terms_version: version } })
  );

  return { success: true };
}
