'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { profile } from '@zivoe/database/schema';

import { getCountryLabel } from '@/types/countries';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { qstash } from '@/server/clients/qstash';
import { captureServerEvent } from '@/server/utils/analytics';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';
import { type OnboardingFormData, onboardingSchema } from '@/lib/schemas/onboarding';
import { handlePromise } from '@/lib/utils';

import { BASE_URL } from '../utils/base-url';

export async function completeOnboarding(data: OnboardingFormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) return { error: 'Unauthorized' };

  const result = onboardingSchema.safeParse(data);
  if (!result.success) return { error: 'Invalid form data' };

  const validated = result.data;

  const insertData =
    validated.accountType === 'individual'
      ? {
          id: session.user.id,
          accountType: validated.accountType,
          firstName: validated.firstName,
          lastName: validated.lastName,
          countryOfResidence: validated.countryOfResidence,
          amountOfInterest: validated.amountOfInterest,
          howFoundZivoe: validated.howFoundZivoe
        }
      : {
          id: session.user.id,
          accountType: validated.accountType,
          firstName: validated.firstName,
          lastName: validated.lastName,
          jobTitle: validated.jobTitle,
          entityName: validated.entityName,
          countryOfIncorporation: validated.countryOfIncorporation,
          amountOfInterest: validated.amountOfInterest,
          howFoundZivoe: validated.howFoundZivoe
        };

  const { err, res } = await handlePromise(
    db.insert(profile).values(insertData).onConflictDoNothing({ target: profile.id }).returning()
  );

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'complete-onboarding' },
      extra: { userId: session.user.id }
    });
    return { error: 'Failed to complete onboarding. Please try again.' };
  }

  // onConflictDoNothing returns no rows when a profile already exists — the
  // user is already onboarded, so skip the one-time side effects below.
  if (!res?.length) redirect('/');

  after(async () => {
    const flows = ['schedule-welcome-email', 'schedule-telegram-notification', 'onboarding-posthog-capture'];
    const { id, firstName, lastName, ...rest } = insertData;
    const country = rest.accountType === 'individual' ? rest.countryOfResidence : rest.countryOfIncorporation;

    const results = await Promise.allSettled([
      qstash.publishJSON({
        url: `${BASE_URL}/api/email/welcome`,
        body: { userId: session.user.id },
        retries: 3,
        deduplicationId: `onboarding-welcome-${session.user.id}`,
        failureCallback: getQstashFailureCallback(BASE_URL),
        label: QSTASH_JOB_LABELS.emailWelcome
      }),

      qstash.publishJSON({
        url: `${BASE_URL}/api/telegram/onboarding`,
        body: { userId: session.user.id, email: session.user.email, name: `${firstName} ${lastName}`, ...rest },
        retries: 3,
        deduplicationId: `onboarding-telegram-${session.user.id}`,
        failureCallback: getQstashFailureCallback(BASE_URL),
        label: QSTASH_JOB_LABELS.telegramOnboarding
      }),

      captureServerEvent({
        distinctId: session.user.id,
        event: 'onboarding:completed',
        properties: {
          account_type: rest.accountType,
          amount_of_interest: rest.amountOfInterest,
          how_found_zivoe: rest.howFoundZivoe,
          country,
          country_name: getCountryLabel(country),
          $set: { ...rest, authId: id, name: `${firstName} ${lastName}` }
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
