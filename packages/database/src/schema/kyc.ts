import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { kycStatusValues } from '../kyc';
import { user } from './auth';

export * from '../kyc';

export const kycStatusEnum = pgEnum('kyc_status', kycStatusValues);

/**
 * One KYC Verification per user — the app's read model of a Persona inquiry:
 * identifiers, a Verification Status, the attempt count and timestamps. No
 * PII, ever: names, documents and images stay in Persona. Rows are created
 * lazily on the first start (or the first webhook), so a missing row is
 * `not_started`.
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
    attemptCount: integer('attempt_count').notNull().default(0),
    /** When `status` last changed — the regression guard compares event timestamps against it. */
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull(),
    /** When the row was last confirmed against Persona (webhook, sweep or lazy refresh). */
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  // The Reconciliation Sweep selects by status and either timestamp every 15 minutes, forever.
  (table) => [
    index('kyc_verification_status_last_synced_idx').on(table.status, table.lastSyncedAt),
    index('kyc_verification_status_changed_idx').on(table.status, table.statusChangedAt),
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
