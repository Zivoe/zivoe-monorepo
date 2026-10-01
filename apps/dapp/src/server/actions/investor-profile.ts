'use server';

import { headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';
import { and, eq, sql } from 'drizzle-orm';

import { profile } from '@zivoe/database/schema';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { kycVerification } from '@/server/kyc';

import { type InvestorProfileFormData, investorProfileSchema } from '@/lib/schemas/onboarding';
import { handlePromise } from '@/lib/utils';

/**
 * The Investor Profile step's save: the onboarding answers an individual
 * confirmed or corrected on `/verification`, written to their profile so the
 * inquiry `startKyc` creates next is prefilled from what they confirmed.
 * Individuals only — an organization's details are the team's to change —
 * never the email, which is the sign-in identity, and only while a
 * verification can still start: once an inquiry exists, Persona holds what
 * the investor submitted and the profile is no longer what gets verified.
 */
export async function updateInvestorProfile(
  data: InvestorProfileFormData
): Promise<{ success?: true; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const result = investorProfileSchema.safeParse(data);
  if (!result.success) return { error: 'Invalid form data' };

  // The page hides the step past this point; the action holds the same line.
  const view = await kycVerification.getKycStatus({ userId: session.user.id });
  if (!view.canStart) return { error: 'Your details can no longer be changed here.' };

  const { err, res } = await handlePromise(
    db
      .update(profile)
      .set({ ...result.data, updatedAt: sql`now()` })
      .where(and(eq(profile.id, session.user.id), eq(profile.accountType, 'individual')))
      .returning({ id: profile.id })
  );

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'update-investor-profile' },
      extra: { userId: session.user.id }
    });
    return { error: 'Failed to save your details. Please try again.' };
  }

  // No row: not onboarded, or an organization — neither has a profile this step may edit.
  if (!res?.length) return { error: 'Only an individual profile can be updated here.' };

  return { success: true };
}
