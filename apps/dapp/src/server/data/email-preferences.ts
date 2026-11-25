import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { eq, sql } from 'drizzle-orm';

import { user, userEmailPreferences } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';
import { getBeehiivNewsletterPreference } from '@/server/utils/beehiiv';
import {
  type UnsubscribeBucket,
  doesUnsubscribeTokenMatchEmail,
  verifyUnsubscribeToken
} from '@/server/utils/unsubscribe';

import { getUser } from './auth';

export type AppEmailPreferences = {
  productTips: boolean;
  transactionReceipts: boolean;
};

export type EmailPreferences = AppEmailPreferences & {
  newsletter: boolean | null;
};

const DEFAULT_APP_EMAIL_PREFERENCES: AppEmailPreferences = {
  productTips: true,
  transactionReceipts: true
};

type UnsubscribeActor = {
  userId: string;
  email: string;
  source: 'session' | 'token';
  tokenBucket: UnsubscribeBucket | null;
};

export type ResolveUnsubscribeActorResult =
  | { status: 'authorized'; actor: UnsubscribeActor }
  | { status: 'invalid_token' }
  | { status: 'unauthorized' };

export async function resolveUnsubscribeActor({
  token
}: {
  token?: string | null;
}): Promise<ResolveUnsubscribeActorResult> {
  if (token) {
    const payload = verifyUnsubscribeToken(token);
    if (!payload) return { status: 'invalid_token' };

    const result = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, payload.sub))
      .limit(1);

    const matchedUser = result[0];
    if (!matchedUser) return { status: 'invalid_token' };
    if (!doesUnsubscribeTokenMatchEmail({ payload, email: matchedUser.email })) return { status: 'invalid_token' };

    return {
      status: 'authorized',
      actor: {
        userId: matchedUser.id,
        email: matchedUser.email,
        source: 'token',
        tokenBucket: payload.bucket
      }
    };
  }

  const { user: currentUser } = await getUser();
  if (!currentUser?.id || !currentUser.email) return { status: 'unauthorized' };

  return {
    status: 'authorized',
    actor: {
      userId: currentUser.id,
      email: currentUser.email,
      source: 'session',
      tokenBucket: null
    }
  };
}

export async function getAppEmailPreferences({ userId }: { userId: string }): Promise<AppEmailPreferences> {
  const result = await db
    .select({
      productTips: userEmailPreferences.productTipsEnabled,
      transactionReceipts: userEmailPreferences.transactionReceiptsEnabled
    })
    .from(userEmailPreferences)
    .where(eq(userEmailPreferences.userId, userId))
    .limit(1);

  return result[0] ?? DEFAULT_APP_EMAIL_PREFERENCES;
}

/**
 * Everything the preferences form shows: the app's own toggles, and the newsletter as Beehiiv has it. Beehiiv
 * being down does not take the page with it: the newsletter reads null, which the form shows as unavailable.
 * Throws when the app's own toggles cannot be read.
 */
export async function getEmailPreferences({ userId, email }: { userId: string; email: string }) {
  const [appPreferences, newsletter] = await Promise.all([
    getAppEmailPreferences({ userId }),
    getBeehiivNewsletterPreference(email).catch((error: unknown) => {
      Sentry.captureException(error, { tags: { source: 'SERVER', flow: 'newsletter-preference' } });
      return null;
    })
  ]);
  return { ...appPreferences, newsletter } satisfies EmailPreferences;
}

export async function saveAppEmailPreferences({
  userId,
  changes
}: {
  userId: string;
  changes: Partial<AppEmailPreferences>;
}): Promise<AppEmailPreferences> {
  const valuesToSet: Partial<typeof userEmailPreferences.$inferInsert> = {};

  if (changes.productTips !== undefined) valuesToSet.productTipsEnabled = changes.productTips;
  if (changes.transactionReceipts !== undefined) valuesToSet.transactionReceiptsEnabled = changes.transactionReceipts;

  if (Object.keys(valuesToSet).length === 0) return getAppEmailPreferences({ userId });

  const result = await db
    .insert(userEmailPreferences)
    .values({
      userId,
      productTipsEnabled: changes.productTips ?? true,
      transactionReceiptsEnabled: changes.transactionReceipts ?? true
    })
    .onConflictDoUpdate({
      target: userEmailPreferences.userId,
      set: {
        ...valuesToSet,
        updatedAt: sql`now()`
      }
    })
    .returning({
      productTips: userEmailPreferences.productTipsEnabled,
      transactionReceipts: userEmailPreferences.transactionReceiptsEnabled
    });

  return result[0] ?? DEFAULT_APP_EMAIL_PREFERENCES;
}

type LocalEmailPreferenceBucket = Exclude<UnsubscribeBucket, 'manage' | 'newsletter'>;

export async function setEmailPreferenceBucketEnabled({
  userId,
  bucket,
  enabled
}: {
  userId: string;
  bucket: LocalEmailPreferenceBucket;
  enabled: boolean;
}) {
  const changes = bucket === 'product_tips' ? { productTips: enabled } : { transactionReceipts: enabled };

  return saveAppEmailPreferences({ userId, changes });
}

export async function isEmailPreferenceEnabled({
  userId,
  bucket
}: {
  userId: string;
  bucket: LocalEmailPreferenceBucket;
}) {
  const result = await db
    .select({
      productTips: userEmailPreferences.productTipsEnabled,
      transactionReceipts: userEmailPreferences.transactionReceiptsEnabled
    })
    .from(userEmailPreferences)
    .where(eq(userEmailPreferences.userId, userId))
    .limit(1);

  const preferences = result[0];
  if (!preferences) return true;

  if (bucket === 'product_tips') return preferences.productTips;
  return preferences.transactionReceipts;
}
