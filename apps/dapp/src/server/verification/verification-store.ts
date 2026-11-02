import 'server-only';

import { and, asc, count, eq, gt, inArray, lt, sql } from 'drizzle-orm';

import { type AccountType } from '@zivoe/database/onboarding';
import { kycVerification, kycWebhookEvent, profile, user } from '@zivoe/database/schema';

import { isSupportedCountryCode } from '@/types/countries';

import { type Db } from '@/server/clients/db';

import { type VerificationStore } from './verification';

/**
 * The flow a row belongs to: the profile's account type, read in the same
 * query. A row whose profile is gone — only a hand-deleted row can be, both
 * cascade from the user — reads as an individual's rather than vanishing.
 */
const accountType = sql<AccountType>`coalesce(${profile.accountType}, 'individual')`;

/** The row plus the flow it belongs to. */
const storedColumns = {
  userId: kycVerification.userId,
  status: kycVerification.status,
  personaInquiryId: kycVerification.personaInquiryId,
  personaAccountId: kycVerification.personaAccountId,
  personaCaseId: kycVerification.personaCaseId,
  personaCaseStatus: kycVerification.personaCaseStatus,
  sourceAt: kycVerification.sourceAt,
  statusChangedAt: kycVerification.statusChangedAt,
  lastSyncedAt: kycVerification.lastSyncedAt,
  version: kycVerification.version,
  accountType
};

/** The VerificationStore port over drizzle. Infrastructure failures reject, as the port allows. */
export function createPostgresVerificationStore({ db }: { db: Db }): VerificationStore {
  const stored = () =>
    db.select(storedColumns).from(kycVerification).leftJoin(profile, eq(profile.id, kycVerification.userId));

  return {
    async get({ userId }) {
      const rows = await stored().where(eq(kycVerification.userId, userId)).limit(1);
      return rows[0] ?? null;
    },

    async getByInquiryIds({ inquiryIds }) {
      if (inquiryIds.length === 0) return [];
      return stored().where(inArray(kycVerification.personaInquiryId, [...inquiryIds]));
    },

    async write(record, { expectVersion }) {
      // The columns spelled out: a record read from the store carries its
      // flow and version too, and neither is the caller's to write.
      const values = {
        userId: record.userId,
        status: record.status,
        personaInquiryId: record.personaInquiryId,
        personaAccountId: record.personaAccountId,
        personaCaseId: record.personaCaseId,
        personaCaseStatus: record.personaCaseStatus,
        sourceAt: record.sourceAt,
        statusChangedAt: record.statusChangedAt,
        lastSyncedAt: record.lastSyncedAt
      };
      const written =
        expectVersion === null
          ? // A row inserted meanwhile wins; an inquiry another row holds still fails loudly.
            await db
              .insert(kycVerification)
              .values({ ...values, version: 0 })
              .onConflictDoNothing({ target: kycVerification.userId })
              .returning({ version: kycVerification.version })
          : await db
              .update(kycVerification)
              .set({ ...values, version: expectVersion + 1, updatedAt: sql`now()` })
              .where(and(eq(kycVerification.userId, record.userId), eq(kycVerification.version, expectVersion)))
              .returning({ version: kycVerification.version });
      return written[0]?.version ?? null;
    },

    async markSynced({ userId, syncedAt }) {
      await db
        .update(kycVerification)
        .set({ lastSyncedAt: syncedAt, updatedAt: sql`now()` })
        .where(eq(kycVerification.userId, userId));
    },

    async recordEventIfAbsent({ eventId, receivedAt }) {
      const inserted = await db
        .insert(kycWebhookEvent)
        .values({ id: eventId, receivedAt })
        .onConflictDoNothing()
        .returning({ id: kycWebhookEvent.id });
      return inserted.length > 0;
    },

    async deleteEventsBefore({ receivedBefore }) {
      const deleted = await db
        .delete(kycWebhookEvent)
        .where(lt(kycWebhookEvent.receivedAt, receivedBefore))
        .returning({ id: kycWebhookEvent.id });
      return deleted.length;
    },

    async list({ statuses, accountType: flow, userIds, syncedBefore, changedBefore, changedAfter, limit }) {
      return stored()
        .where(
          and(
            inArray(kycVerification.status, [...statuses]),
            flow ? eq(accountType, flow) : undefined,
            userIds ? inArray(kycVerification.userId, [...userIds]) : undefined,
            syncedBefore ? lt(kycVerification.lastSyncedAt, syncedBefore) : undefined,
            changedBefore ? lt(kycVerification.statusChangedAt, changedBefore) : undefined,
            changedAfter ? gt(kycVerification.statusChangedAt, changedAfter) : undefined
          )
        )
        .orderBy(asc(kycVerification.lastSyncedAt))
        .limit(limit);
    },

    async count({ statuses, accountType: flow, caseStatuses, changedBefore }) {
      const rows = await db
        .select({ total: count() })
        .from(kycVerification)
        .leftJoin(profile, eq(profile.id, kycVerification.userId))
        .where(
          and(
            inArray(kycVerification.status, [...statuses]),
            flow ? eq(accountType, flow) : undefined,
            caseStatuses ? inArray(kycVerification.personaCaseStatus, [...caseStatuses]) : undefined,
            lt(kycVerification.statusChangedAt, changedBefore)
          )
        );
      return rows[0]?.total ?? 0;
    },

    async getProfile({ userId }) {
      const rows = await db
        .select({
          accountType: profile.accountType,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: user.email,
          countryOfResidence: profile.countryOfResidence,
          entityName: profile.entityName,
          countryOfIncorporation: profile.countryOfIncorporation
        })
        .from(profile)
        .innerJoin(user, eq(user.id, profile.id))
        .where(eq(profile.id, userId))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      // Onboarding stores the ISO code Persona prefills by; anything else (a legacy name) prefills nothing.
      const toCode = (value: string | null) => (value && isSupportedCountryCode(value) ? value : null);
      const { countryOfResidence, countryOfIncorporation, ...rest } = row;
      return {
        ...rest,
        countryCode: toCode(countryOfResidence),
        countryOfIncorporationCode: toCode(countryOfIncorporation)
      };
    }
  };
}
