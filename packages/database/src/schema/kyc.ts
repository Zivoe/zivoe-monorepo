import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { verificationStatusValues } from '../kyc';
import { user } from './auth';

export * from '../kyc';

export const kycStatusEnum = pgEnum('kyc_status', verificationStatusValues);

/**
 * One Verification per user — the app's read model of a Persona inquiry and,
 * for an organization, of the KYB case that decides it: identifiers, a
 * Verification Status and timestamps. The profile's account type says which
 * flow the row is (an individual's KYC, an organization's KYB). No PII,
 * ever: names, documents and images stay in Persona. Rows are created lazily
 * on the first start (or the first webhook), so a missing row is `not_started`.
 */
export const kycVerification = pgTable(
  'kyc_verification',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: kycStatusEnum('status').notNull(),
    personaInquiryId: text('persona_inquiry_id'),
    personaAccountId: text('persona_account_id'),
    /** The KYB case the row follows, once the Workflow has created one; null for an individual. */
    personaCaseId: text('persona_case_id'),
    /** Persona's raw case status ("Waiting on UBOs", "Ready for Review", …), for copy and digests only. */
    personaCaseStatus: text('persona_case_status'),
    /**
     * Persona's clock for the newest snapshot the row has taken: an older
     * delivery or read loses against it. The app always sets it; the default
     * only serves an app that predates the column, between a migration and
     * the deploy that follows it.
     */
    sourceAt: timestamp('source_at', { withTimezone: true }).notNull().defaultNow(),
    /** When `status` last changed — the identity of the transition a notification announces. */
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull(),
    /** When the row was last confirmed against Persona (webhook, sweep or lazy refresh). */
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull(),
    /** Bumped by every write: a writer that read an older version loses and decides again. */
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  // The Reconciliation Sweep selects by status and either timestamp every 15 minutes, forever.
  (table) => [
    index('kyc_verification_status_last_synced_idx').on(table.status, table.lastSyncedAt),
    index('kyc_verification_status_changed_idx').on(table.status, table.statusChangedAt),
    // A case event names the row by the inquiry it lists, so an inquiry belongs to one row.
    uniqueIndex('kyc_verification_persona_inquiry_id_uidx')
      .on(table.personaInquiryId)
      .where(sql`${table.personaInquiryId} is not null`),
    // `not_started` is the absence of a row; a stored one would be swept,
    // refreshed and rendered by nobody, so the database refuses it outright.
    check('kyc_verification_status_is_stored', sql`${table.status} <> 'not_started'`)
  ]
);

/**
 * Persona webhook events already processed, keyed by Persona's event id.
 * Insert-if-absent is the idempotency check that makes at-least-once delivery
 * harmless.
 */
export const kycWebhookEvent = pgTable('kyc_webhook_event', {
  id: text('id').primaryKey(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
});
