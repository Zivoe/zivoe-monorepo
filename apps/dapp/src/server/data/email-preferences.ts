import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { user, userEmailPreferences } from '@/server/db/schema';
import { UnsubscribeBucket, doesUnsubscribeTokenMatchEmail, verifyUnsubscribeToken } from '@/server/utils/unsubscribe';

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

    const result = await authDb
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
  const result = await authDb
    .select({
      productTips: userEmailPreferences.productTipsEnabled,
      transactionReceipts: userEmailPreferences.transactionReceiptsEnabled
    })
    .from(userEmailPreferences)
    .where(eq(userEmailPreferences.userId, userId))
    .limit(1);

  return result[0] ?? DEFAULT_APP_EMAIL_PREFERENCES;
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

  const result = await authDb
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
  const result = await authDb
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
