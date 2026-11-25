import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

import {
  organizationInvitationCancelReasonValues,
  organizationInvitationStatusValues,
  subjectKindValues
} from '../organizations';
import { user } from './auth';

export * from '../organizations';

export const subjectKindEnum = pgEnum('subject_kind', subjectKindValues);
export const organizationInvitationStatusEnum = pgEnum(
  'organization_invitation_status',
  organizationInvitationStatusValues
);
export const organizationInvitationCancelReasonEnum = pgEnum(
  'organization_invitation_cancel_reason',
  organizationInvitationCancelReasonValues
);

/**
 * A company investing through Zivoe. It is verified as a whole (KYB) by any one
 * of its members, and owns its Linked addresses. Never hard-deleted: its last
 * member may soft-delete it, and its links, Persona history and ops trail stay.
 */
export const organization = pgTable('organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The legal name Persona verifies; locked once the organization has an inquiry. */
  name: text('name').notNull(),
  /** ISO 3166-1 alpha-2; locked with the name. Null only for an organization carried over without one. */
  countryOfIncorporation: text('country_of_incorporation'),
  createdByUserId: uuid('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Who a Verification and a Wallet link belong to: one row per person and per
 * organization. Its id is the person's user id or the organization's id, never
 * changes, and is the reference id Persona knows the subject by. Written in the
 * same transaction as the profile or the organization.
 */
export const verificationSubject = pgTable(
  'verification_subject',
  {
    id: uuid('id').primaryKey(),
    kind: subjectKindEnum('kind').notNull(),
    userId: uuid('user_id')
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .unique()
      .references(() => organization.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    // Each side says IS NOT NULL: a check that reads NULL passes, so `user_id = id` alone let a subject with
    // neither id through.
    check(
      'verification_subject_is_who_it_says',
      sql`(${table.kind} = 'individual' AND ${table.userId} IS NOT NULL AND ${table.userId} = ${table.id} AND ${table.organizationId} IS NULL) OR (${table.kind} = 'organization' AND ${table.organizationId} IS NOT NULL AND ${table.organizationId} = ${table.id} AND ${table.userId} IS NULL)`
    )
  ]
);

/** One person's place in an organization. No roles: every member can do what any member can. */
export const organizationMember = pgTable(
  'organization_member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The person's job title at this organization. */
    title: text('title'),
    /** The invitation that brought them in; null for the one who created it. */
    invitationId: uuid('invitation_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique('organization_member_org_user_unique').on(table.organizationId, table.userId),
    index('organization_member_user_id_idx').on(table.userId)
  ]
);

/**
 * An invitation to one email address. It carries no secret: accepting takes a
 * signed-in account whose verified email, read from the database, is this one.
 * `email` is lowercase. One `pending` row per (organization, email).
 */
export const organizationInvitation = pgTable(
  'organization_invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    email: text('email').notNull(),
    invitedByUserId: uuid('invited_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    status: organizationInvitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull(),
    sendCount: integer('send_count').notNull().default(1),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    cancelReason: organizationInvitationCancelReasonEnum('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('organization_invitation_pending_uidx')
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
    index('organization_invitation_email_idx').on(table.email, table.status),
    index('organization_invitation_org_status_idx').on(table.organizationId, table.status),
    check('organization_invitation_email_lowercase', sql`${table.email} = lower(${table.email})`)
  ]
);

/**
 * One row each time a member takes another out: the record of who removed whom, and what the removed
 * person's email is checked against before it goes (a row that never committed sends nothing). Kept
 * when either account is deleted.
 */
export const organizationMemberRemoval = pgTable(
  'organization_member_removal',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    removedByUserId: uuid('removed_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    removedAt: timestamp('removed_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('organization_member_removal_org_idx').on(table.organizationId)]
);
