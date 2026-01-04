'use server';

import { headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';
import { eq, sql } from 'drizzle-orm';

import { auth } from '@/server/auth';
import { authDb } from '@/server/clients/auth-db';
import { profile } from '@/server/db/schema';

import { type OnboardingFormData, onboardingSchema } from '@/lib/schemas/onboarding';

export async function completeOnboarding(data: OnboardingFormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) return { error: 'Unauthorized' };

  const result = onboardingSchema.safeParse(data);
  if (!result.success) return { error: 'Invalid form data' };

  const validated = result.data;

  try {
    const updateData =
      validated.accountType === 'individual'
        ? {
            accountType: validated.accountType,
            firstName: validated.firstName,
            lastName: validated.lastName,
            countryOfResidence: validated.countryOfResidence,
            amountOfInterest: validated.amountOfInterest,
            howFoundZivoe: validated.howFoundZivoe,
            onboardedAt: sql`now()`,
            updatedAt: sql`now()`
          }
        : {
            accountType: validated.accountType,
            firstName: validated.firstName,
            lastName: validated.lastName,
            jobTitle: validated.jobTitle,
            entityName: validated.entityName,
            countryOfIncorporation: validated.countryOfIncorporation,
            amountOfInterest: validated.amountOfInterest,
            howFoundZivoe: validated.howFoundZivoe,
            onboardedAt: sql`now()`,
            updatedAt: sql`now()`
          };

    await authDb.update(profile).set(updateData).where(eq(profile.id, session.user.id));

    return { success: true };
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'complete-onboarding' } });
    return { error: 'Failed to complete onboarding. Please try again.' };
  }
}
