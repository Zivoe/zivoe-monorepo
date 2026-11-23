import 'server-only';

import { and, asc, count, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';

import {
  kycVerification,
  kycWebhookEvent,
  organization,
  profile,
  user,
  verificationSubject
} from '@zivoe/database/schema';

import { isSupportedCountryCode } from '@/types/countries';

import { type Db } from '@/server/clients/db';

import { type VerificationStore } from './verification';

/** Onboarding stores the ISO code Persona prefills by; anything else (a legacy name) prefills nothing. */
const toCode = (value: string | null) => (value && isSupportedCountryCode(value) ? value : null);

/** The row plus the flow it belongs to. */
const storedColumns = {
  subjectId: kycVerification.subjectId,
  startedByUserId: kycVerification.startedByUserId,
  status: kycVerification.status,
  personaInquiryId: kycVerification.personaInquiryId,
  personaAccountId: kycVerification.personaAccountId,
  personaCaseId: kycVerification.personaCaseId,
  personaCaseStatus: kycVerification.personaCaseStatus,
  sourceAt: kycVerification.sourceAt,
  statusChangedAt: kycVerification.statusChangedAt,
  lastSyncedAt: kycVerification.lastSyncedAt,
  version: kycVerification.version,
  subjectKind: verificationSubject.kind
};

/** The VerificationStore port over drizzle. Infrastructure failures reject, as the port allows. */
export function createPostgresVerificationStore({ db }: { db: Db }): VerificationStore {
  const stored = () =>
    db
      .select(storedColumns)
      .from(kycVerification)
      .innerJoin(verificationSubject, eq(verificationSubject.id, kycVerification.subjectId));

  return {
    async get({ subjectId }) {
      const rows = await stored().where(eq(kycVerification.subjectId, subjectId)).limit(1);
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
        subjectId: record.subjectId,
        startedByUserId: record.startedByUserId,
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
              .onConflictDoNothing({ target: kycVerification.subjectId })
              .returning({ version: kycVerification.version })
          : await db
              .update(kycVerification)
              .set({ ...values, version: expectVersion + 1, updatedAt: sql`now()` })
              .where(and(eq(kycVerification.subjectId, record.subjectId), eq(kycVerification.version, expectVersion)))
              .returning({ version: kycVerification.version });
      return written[0]?.version ?? null;
    },

    async markSynced({ subjectId, syncedAt }) {
      await db
        .update(kycVerification)
        .set({ lastSyncedAt: syncedAt, updatedAt: sql`now()` })
        .where(eq(kycVerification.subjectId, subjectId));
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

    async list({
      statuses,
      subjectKind: flow,
      subjectIds,
      notDeleted,
      syncedBefore,
      changedBefore,
      changedAfter,
      limit
    }) {
      return stored()
        .leftJoin(organization, eq(organization.id, verificationSubject.organizationId))
        .where(
          and(
            inArray(kycVerification.status, [...statuses]),
            flow ? eq(verificationSubject.kind, flow) : undefined,
            subjectIds ? inArray(kycVerification.subjectId, [...subjectIds]) : undefined,
            notDeleted ? isNull(organization.deletedAt) : undefined,
            syncedBefore ? lt(kycVerification.lastSyncedAt, syncedBefore) : undefined,
            changedBefore ? lt(kycVerification.statusChangedAt, changedBefore) : undefined,
            changedAfter ? gt(kycVerification.statusChangedAt, changedAfter) : undefined
          )
        )
        .orderBy(asc(kycVerification.lastSyncedAt))
        .limit(limit);
    },

    async count({ statuses, subjectKind: flow, caseStatuses, changedBefore }) {
      const rows = await db
        .select({ total: count() })
        .from(kycVerification)
        .innerJoin(verificationSubject, eq(verificationSubject.id, kycVerification.subjectId))
        .where(
          and(
            inArray(kycVerification.status, [...statuses]),
            flow ? eq(verificationSubject.kind, flow) : undefined,
            caseStatuses ? inArray(kycVerification.personaCaseStatus, [...caseStatuses]) : undefined,
            lt(kycVerification.statusChangedAt, changedBefore)
          )
        );
      return rows[0]?.total ?? 0;
    },

    async getSubject({ subjectId }) {
      // Who the subject's mail and operator lines name: the person, or the
      // organization's starter, joined through its record.
      const rows = await db
        .select({
          subjectKind: verificationSubject.kind,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: user.email,
          countryOfResidence: profile.countryOfResidence,
          entityName: organization.name,
          countryOfIncorporation: organization.countryOfIncorporation,
          deletedAt: organization.deletedAt
        })
        .from(verificationSubject)
        .leftJoin(organization, eq(organization.id, verificationSubject.organizationId))
        .leftJoin(kycVerification, eq(kycVerification.subjectId, verificationSubject.id))
        .leftJoin(user, eq(user.id, sql`coalesce(${verificationSubject.userId}, ${kycVerification.startedByUserId})`))
        .leftJoin(profile, eq(profile.id, user.id))
        .where(eq(verificationSubject.id, subjectId))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      const { countryOfResidence, countryOfIncorporation, deletedAt, ...rest } = row;
      return {
        ...rest,
        countryCode: toCode(countryOfResidence),
        countryOfIncorporationCode: toCode(countryOfIncorporation),
        deleted: !!deletedAt
      };
    },

    async getPerson({ userId }) {
      const rows = await db
        .select({
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
      const { countryOfResidence, ...rest } = row;
      return { ...rest, countryCode: toCode(countryOfResidence) };
    }
  };
}
