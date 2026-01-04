'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { eq, sql } from 'drizzle-orm';

import { auth } from '@/server/auth';
import { authDb } from '@/server/clients/auth-db';
import { posthog } from '@/server/clients/posthog';
import { qstash } from '@/server/clients/qstash';
import { profile } from '@/server/db/schema';
import { BASE_URL } from '@/server/utils/base-url';

import { type OnboardingFormData, onboardingSchema } from '@/lib/schemas/onboarding';
import { handlePromise } from '@/lib/utils';

export async function completeOnboarding(data: OnboardingFormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) return { error: 'Unauthorized' };

  const result = onboardingSchema.safeParse(data);
  if (!result.success) return { error: 'Invalid form data' };

  const validated = result.data;

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

  const { err, res } = await handlePromise(
    authDb.update(profile).set(updateData).where(eq(profile.id, session.user.id)).returning()
  );

  if (err || !res?.length) {
    Sentry.captureException(err ?? new Error('Profile not found'), {
      tags: { source: 'SERVER', flow: 'complete-onboarding' },
      extra: { userId: session.user.id }
    });

    return { error: 'Failed to complete onboarding. Please try again.' };
  }

  // TODO: test after on Vercel
  after(async () => {
    const flows = ['schedule-welcome-email', 'schedule-telegram-notification', 'onboarding-posthog-capture'];
    const { onboardedAt, updatedAt, firstName, lastName, ...rest } = updateData;

    const results = await Promise.allSettled([
      qstash.publishJSON({
        url: `${BASE_URL}/api/email/welcome`,
        body: { userId: session.user.id },
        retries: 3,
        deduplicationId: `onboarding-welcome-${session.user.id}`,
        failureCallback: `${BASE_URL}/api/qstash/failure`
      }),

      qstash.publishJSON({
        url: `${BASE_URL}/api/telegram/onboarding`,
        body: { userId: session.user.id, email: session.user.email, name: `${firstName} ${lastName}`, ...rest },
        retries: 3,
        deduplicationId: `onboarding-telegram-${session.user.id}`,
        failureCallback: `${BASE_URL}/api/qstash/failure`
      }),

      posthog.captureImmediate({
        distinctId: session.user.id,
        event: 'onboarding:completed',
        properties: {
          $set: rest
        }
      })
    ]);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        Sentry.captureException(result.reason, {
          tags: { source: 'SERVER', flow: flows[index] },
          extra: { userId: session.user.id }
        });
      }
    });
  });

  return { success: true };
}
