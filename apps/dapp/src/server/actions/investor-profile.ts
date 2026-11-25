'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';
import { eq, sql } from 'drizzle-orm';

import { profile } from '@zivoe/database/schema';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { getOnboardingStep } from '@/server/data/auth';
import { verification } from '@/server/verification';
import { isKycEnabled } from '@/server/verification/kyc-flag';

import { type InvestorProfileFormData, investorProfileSchema } from '@/lib/schemas/onboarding';
import { handlePromise } from '@/lib/utils';

/**
 * The Account details step's save for a person: the answers they confirmed or
 * corrected on `/verification`, written to the profile so the inquiry
 * `startVerification` creates next is prefilled from what they confirmed. Never
 * the email, which is the sign-in identity, and only while their own
 * verification can still start: once an inquiry exists, Persona holds what was
 * submitted and the profile is no longer what gets verified. An organization's
 * details are saved by `updateOrganization`.
 */
export async function updateInvestorProfile(
  data: InvestorProfileFormData
): Promise<{ success?: true; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: 'Unauthorized' };
  // Behind the `kyc` flag, like the page that calls it.
  if (!(await isKycEnabled({ user: session.user }))) return { error: 'Unauthorized' };
  // Behind onboarding and the current terms, like the page: a `/verification` left open across a terms update
  // cannot save until the terms are accepted. The caller's refresh lets the page's own redirect take over.
  if (await getOnboardingStep(session.user.id)) return { error: 'Unauthorized' };

  // The page hides the step past this point; the action holds the same line.
  const view = await verification.getVerificationStatus({ subjectId: session.user.id, viewerUserId: session.user.id });
  if (!view.canStart) return { error: 'Your details can no longer be changed here.' };

  const result = investorProfileSchema.safeParse(data);
  if (!result.success) return { error: 'Invalid form data' };

  const { err, res } = await handlePromise(
    db
      .update(profile)
      .set({ ...result.data, updatedAt: sql`now()` })
      .where(eq(profile.id, session.user.id))
      .returning({ id: profile.id })
  );

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'update-investor-profile' },
      extra: { userId: session.user.id }
    });
    return { error: 'Failed to save your details. Please try again.' };
  }

  // No row: not onboarded.
  if (!res?.length) return { error: 'No profile to update.' };

  // Back to Account details must show what was just saved, not the router's earlier copy.
  revalidatePath('/verification');
  return { success: true };
}
