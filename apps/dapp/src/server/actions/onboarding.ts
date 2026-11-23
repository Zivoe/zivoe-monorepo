'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { profile, verificationSubject } from '@zivoe/database/schema';

import { getCountryLabel } from '@/types/countries';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';
import { qstash } from '@/server/clients/qstash';
import { getTermsStatus, isUserOnboarded } from '@/server/data/auth';
import { organizations } from '@/server/organizations';
import { captureServerEvent } from '@/server/utils/analytics';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';
import { type OnboardingFormData, onboardingSchema } from '@/lib/schemas/onboarding';
import { type OrganizationDetailsFormData, organizationDetailsSchema } from '@/lib/schemas/organizations';
import { handlePromise } from '@/lib/utils';

import { BASE_URL } from '../utils/base-url';

/** Thrown inside the transaction when the profile already exists, so a second submit creates no organization. */
class AlreadyOnboarded extends Error {}

/**
 * Onboarding's one write, after the terms: the person's profile and their Verification subject, and the
 * organization they invest through when they named one, all or nothing. Answers
 * `organizationId` when an organization was created, so the invite step can follow. A profile that already
 * exists (a double submit, a second tab) answers `alreadyOnboarded`: it writes nothing and sends nothing.
 */
export async function completeOnboarding({
  profile: profileData,
  organization: organizationData
}: {
  profile: OnboardingFormData;
  organization?: OrganizationDetailsFormData;
}): Promise<{ success?: true; organizationId?: string; alreadyOnboarded?: true; error?: string }> {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user?.id) return { error: 'Unauthorized' };
  const userId = session.user.id;

  const result = onboardingSchema.safeParse(profileData);
  const organizationResult = organizationData ? organizationDetailsSchema.safeParse(organizationData) : null;
  if (!result.success || (organizationResult && !organizationResult.success)) return { error: 'Invalid form data' };

  const validated = result.data;
  const organizationDetails = organizationResult?.data;

  // The terms come first: nothing here is saved, and no colleague is invited, before they are accepted.
  if ((await getTermsStatus(userId)) !== 'accepted') return { error: 'Unauthorized' };
  // A second tab, or a second submit: nothing to save, and the client says so instead of welcoming them again.
  if (await isUserOnboarded(userId)) return { success: true, alreadyOnboarded: true };

  // A profile and its Verification subject: every onboarded person is a subject. False when one already existed.
  const saveProfile = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    const rows = await tx
      .insert(profile)
      .values({ id: userId, ...validated })
      .onConflictDoNothing({ target: profile.id })
      .returning({ id: profile.id });
    if (!rows.length) return false;
    await tx.insert(verificationSubject).values({ id: userId, kind: 'individual', userId }).onConflictDoNothing();
    return true;
  };

  const { err, res } = await handlePromise(
    (async (): Promise<{ created: boolean; organizationId?: string }> => {
      if (!organizationDetails) return { created: await db.transaction(saveProfile) };

      const created = await organizations.create({
        userId,
        details: organizationDetails,
        before: async (tx) => {
          if (!(await saveProfile(tx))) throw new AlreadyOnboarded();
        }
      });
      // A newcomer belongs to no organization yet, so the cap cannot refuse them; if it ever does, nothing was saved.
      if (!created.ok) throw new Error(`Creating the organization was refused: ${created.error.code}`);
      return { created: true, organizationId: created.value.organizationId };
    })()
  );

  if (err instanceof AlreadyOnboarded) return { success: true, alreadyOnboarded: true };

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'complete-onboarding' },
      extra: { userId }
    });
    return { error: 'Failed to complete onboarding. Please try again.' };
  }

  // No row: a profile already exists, the user is already onboarded, so skip the one-time side effects below.
  // Still a success: the client sends them on to wherever an onboarded user goes.
  if (!res?.created) return { success: true, alreadyOnboarded: true };
  const { organizationId } = res;
  if (organizationId) {
    after(() =>
      captureServerEvent({
        distinctId: userId,
        event: 'organization:created',
        properties: { organization_id: organizationId, source: 'onboarding' }
      })
    );
  }

  after(async () => {
    const flows = ['schedule-welcome-email', 'schedule-telegram-notification', 'onboarding-posthog-capture'];
    const { firstName, lastName, ...rest } = validated;
    const country = rest.countryOfResidence;

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
        // Read by people, so the country goes by name rather than its code.
        body: {
          userId: session.user.id,
          email: session.user.email,
          name: `${firstName} ${lastName}`,
          ...rest,
          countryOfResidence: getCountryLabel(country)
        },
        retries: 3,
        deduplicationId: `onboarding-telegram-${session.user.id}`,
        failureCallback: getQstashFailureCallback(BASE_URL),
        label: QSTASH_JOB_LABELS.telegramOnboarding
      }),

      captureServerEvent({
        distinctId: session.user.id,
        event: 'onboarding:completed',
        properties: {
          amount_of_interest: rest.amountOfInterest,
          how_found_zivoe: rest.howFoundZivoe,
          country,
          country_name: getCountryLabel(country),
          $set: { ...rest, authId: session.user.id, name: `${firstName} ${lastName}` }
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

  return { success: true, organizationId: res.organizationId };
}
