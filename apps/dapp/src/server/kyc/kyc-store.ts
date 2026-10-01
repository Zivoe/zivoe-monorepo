import 'server-only';

import { getCode } from 'country-list';
import { and, asc, count, eq, gt, inArray, lt, notInArray, sql } from 'drizzle-orm';

import { kycVerification, kycWebhookEvent, profile, user } from '@zivoe/database/schema';

import { type Db } from '@/server/clients/db';

import { HUMAN_OWNED_STATUSES } from './kyc-status';
import { type KycStore } from './kyc-verification';

/** The KycStore port over drizzle. Infrastructure failures reject, as the port allows. */
export function createPostgresKycStore({ db }: { db: Db }): KycStore {
  return {
    async get({ userId }) {
      const rows = await db
        .select({
          userId: kycVerification.userId,
          status: kycVerification.status,
          personaInquiryId: kycVerification.personaInquiryId,
          personaAccountId: kycVerification.personaAccountId,
          attemptCount: kycVerification.attemptCount,
          statusChangedAt: kycVerification.statusChangedAt,
          lastSyncedAt: kycVerification.lastSyncedAt
        })
        .from(kycVerification)
        .where(eq(kycVerification.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    },

    async upsert(record, { overrideHumanOwned = false, expectInquiryId }) {
      // Ownership guard: the row must still point at the inquiry the writer
      // read. `is not distinct from`, so a null expectation compares too.
      const ownsInquiry = sql`${kycVerification.personaInquiryId} is not distinct from ${expectInquiryId}`;
      const written = await db
        .insert(kycVerification)
        .values(record)
        .onConflictDoUpdate({
          target: kycVerification.userId,
          set: {
            status: record.status,
            personaInquiryId: record.personaInquiryId,
            personaAccountId: record.personaAccountId,
            attemptCount: record.attemptCount,
            statusChangedAt: record.statusChangedAt,
            lastSyncedAt: record.lastSyncedAt,
            updatedAt: sql`now()`
          },
          // Monotonic guard, decided at the database: a writer holding an
          // older source timestamp than what landed meanwhile loses. So does
          // one over a Human-owned status, unless it is the operator's own,
          // and one for an inquiry the row has moved away from.
          setWhere: overrideHumanOwned
            ? sql`excluded.status_changed_at >= ${kycVerification.statusChangedAt} and ${ownsInquiry}`
            : sql`excluded.status_changed_at >= ${kycVerification.statusChangedAt} and ${notInArray(kycVerification.status, [...HUMAN_OWNED_STATUSES])} and ${ownsInquiry}`
        })
        .returning({ userId: kycVerification.userId });
      return written.length > 0;
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

    async list({ statuses, syncedBefore, changedBefore, changedAfter, limit }) {
      return db
        .select({
          userId: kycVerification.userId,
          status: kycVerification.status,
          personaInquiryId: kycVerification.personaInquiryId,
          personaAccountId: kycVerification.personaAccountId,
          attemptCount: kycVerification.attemptCount,
          statusChangedAt: kycVerification.statusChangedAt,
          lastSyncedAt: kycVerification.lastSyncedAt
        })
        .from(kycVerification)
        .where(
          and(
            inArray(kycVerification.status, [...statuses]),
            syncedBefore ? lt(kycVerification.lastSyncedAt, syncedBefore) : undefined,
            changedBefore ? lt(kycVerification.statusChangedAt, changedBefore) : undefined,
            changedAfter ? gt(kycVerification.statusChangedAt, changedAfter) : undefined
          )
        )
        .orderBy(asc(kycVerification.lastSyncedAt))
        .limit(limit);
    },

    async count({ statuses, changedBefore }) {
      const rows = await db
        .select({ total: count() })
        .from(kycVerification)
        .where(and(inArray(kycVerification.status, [...statuses]), lt(kycVerification.statusChangedAt, changedBefore)));
      return rows[0]?.total ?? 0;
    },

    async getProfile({ userId }) {
      const rows = await db
        .select({
          accountType: profile.accountType,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: user.email,
          countryOfResidence: profile.countryOfResidence
        })
        .from(profile)
        .innerJoin(user, eq(user.id, profile.id))
        .where(eq(profile.id, userId))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      // Onboarding stores the country's display name; Persona prefills by ISO code.
      const { countryOfResidence, ...rest } = row;
      return { ...rest, countryCode: countryOfResidence ? (getCode(countryOfResidence) ?? null) : null };
    }
  };
}
