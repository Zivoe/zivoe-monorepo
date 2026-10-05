'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { termsAcceptance } from '@zivoe/database/schema';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { captureServerEvent } from '@/server/utils/analytics';

import { handlePromise } from '@/lib/utils';

/**
 * Records that the signed-in user accepted the terms, stamped by the database clock: the same clock
 * `app_config.terms_updated_at` is set from, so the two compare cleanly. Each acceptance is a new row.
 */
export async function acceptTerms(): Promise<{ success?: true; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const userId = session.user.id;
  const { err } = await handlePromise(db.insert(termsAcceptance).values({ userId }));

  if (err) {
    Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'accept-terms' }, extra: { userId } });
    return { error: 'Failed to save your acceptance. Please try again.' };
  }

  after(() => captureServerEvent({ distinctId: userId, event: 'terms:accepted' }));

  return { success: true };
}
