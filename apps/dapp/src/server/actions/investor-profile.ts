'use server';

import { headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';
import { and, eq, sql } from 'drizzle-orm';

import { profile } from '@zivoe/database/schema';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { getRequiredStep } from '@/server/data/auth';
import { verification } from '@/server/verification';
import { isKycEnabled } from '@/server/verification/kyc-flag';

import {
  type InvestorProfileFormData,
  type OrganizationProfileFormData,
  investorProfileSchema,
  organizationProfileSchema
} from '@/lib/schemas/onboarding';
import { handlePromise } from '@/lib/utils';

/**
 * The Investor Profile step's save: the onboarding answers an individual or
 * an organization confirmed or corrected on `/verification`, written to the
 * profile so the inquiry `startVerification` creates next is prefilled from what they
 * confirmed. The stored account type says which answers the step may change
 * — never the type itself, never the email, which is the sign-in identity —
 * and only while a verification can still start: once an inquiry exists,
 * Persona holds what was submitted and the profile is no longer what gets
 * verified.
 */
export async function updateInvestorProfile(
  data: InvestorProfileFormData | OrganizationProfileFormData
): Promise<{ success?: true; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: 'Unauthorized' };
  // Behind the `kyc` flag, like the page that calls it.
  if (!(await isKycEnabled({ user: session.user }))) return { error: 'Unauthorized' };
  // Behind onboarding and the current terms, like the page: a `/verification` left open across a terms update
  // cannot save until the terms are accepted. The caller's refresh lets the page's own redirect take over.
  if (await getRequiredStep(session.user.id)) return { error: 'Unauthorized' };

  // The page hides the step past this point; the action holds the same line.
  const view = await verification.getVerificationStatus({ userId: session.user.id });
  if (!view.canStart) return { error: 'Your details can no longer be changed here.' };

  const result = (view.path === 'organization' ? organizationProfileSchema : investorProfileSchema).safeParse(data);
  if (!result.success) return { error: 'Invalid form data' };

  const { err, res } = await handlePromise(
    db
      .update(profile)
      .set({ ...result.data, updatedAt: sql`now()` })
      .where(and(eq(profile.id, session.user.id), eq(profile.accountType, view.path)))
      .returning({ id: profile.id })
  );

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'update-investor-profile' },
      extra: { userId: session.user.id }
    });
    return { error: 'Failed to save your details. Please try again.' };
  }

  // No row: not onboarded, or the account type changed under the step.
  if (!res?.length) return { error: 'No profile to update.' };

  return { success: true };
}
