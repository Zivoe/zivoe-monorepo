'use server';

import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

import { type EmailPreferences, resolveUnsubscribeActor, saveAppEmailPreferences } from '@/server/data/email-preferences';
import { syncBeehiivNewsletterPreference } from '@/server/utils/beehiiv';

import { handlePromise } from '@/lib/utils';

const saveEmailPreferencesSchema = z
  .object({
    token: z.string().min(1).optional(),
    currentNewsletter: z.boolean().nullable(),
    currentProductTips: z.boolean(),
    currentTransactionReceipts: z.boolean(),
    newsletter: z.boolean().optional(),
    productTips: z.boolean().optional(),
    transactionReceipts: z.boolean().optional()
  })
  .refine(
    (value) =>
      value.newsletter !== undefined || value.productTips !== undefined || value.transactionReceipts !== undefined,
    {
      message: 'At least one preference change is required.'
    }
  );

export async function saveEmailPreferencesAction(input: {
  token?: string;
  currentNewsletter: boolean | null;
  currentProductTips: boolean;
  currentTransactionReceipts: boolean;
  newsletter?: boolean;
  productTips?: boolean;
  transactionReceipts?: boolean;
}): Promise<{ success?: true; data?: EmailPreferences; error?: string }> {
  const parsedInput = saveEmailPreferencesSchema.safeParse(input);
  if (!parsedInput.success) return { error: 'Invalid email preference payload.' };

  const actorResult = await resolveUnsubscribeActor({ token: parsedInput.data.token });
  if (actorResult.status === 'invalid_token') {
    return { error: 'This unsubscribe link is invalid or expired. Please open a newer email or sign in.' };
  }

  if (actorResult.status === 'unauthorized') return { error: 'Unauthorized request.' };
  const actor = actorResult.actor;

  const sentryContext = {
    tags: { source: 'SERVER' as const, flow: 'save-email-preferences' },
    extra: { actorSource: actor.source, userId: actor.userId }
  };

  const requestedChanges = {
    productTips: parsedInput.data.productTips,
    transactionReceipts: parsedInput.data.transactionReceipts
  };

  let updatedAppPreferences = {
    productTips: parsedInput.data.currentProductTips,
    transactionReceipts: parsedInput.data.currentTransactionReceipts
  };

  const hasAppPreferenceChanges =
    requestedChanges.productTips !== undefined || requestedChanges.transactionReceipts !== undefined;

  if (hasAppPreferenceChanges) {
    const { res: savedAppPreferences, err: saveErr } = await handlePromise(
      saveAppEmailPreferences({ userId: actor.userId, changes: requestedChanges })
    );

    if (saveErr || !savedAppPreferences) {
      Sentry.captureException(saveErr, sentryContext);
      return { error: 'Failed to update preferences. Please try again.' };
    }

    updatedAppPreferences = savedAppPreferences;
  }

  const currentNewsletter = parsedInput.data.currentNewsletter;
  const requestedNewsletter = parsedInput.data.newsletter;

  const newsletter: EmailPreferences['newsletter'] = requestedNewsletter ?? currentNewsletter;
  const shouldSyncNewsletter = requestedNewsletter !== undefined && requestedNewsletter !== currentNewsletter;

  if (shouldSyncNewsletter) {
    const { err: syncErr } = await handlePromise(
      syncBeehiivNewsletterPreference({ email: actor.email, subscribed: requestedNewsletter })
    );

    if (syncErr) {
      Sentry.captureException(syncErr, {
        ...sentryContext,
        tags: { ...sentryContext.tags, flow: 'save-email-preferences-sync-beehiiv' }
      });
      return { error: 'Newsletter preference could not be updated right now. Please try again.' };
    }
  }

  const data: EmailPreferences = {
    ...updatedAppPreferences,
    newsletter
  };

  return { success: true, data };
}
