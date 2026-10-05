import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

/**
 * Application-wide settings, one row for the whole app (the check refuses a second).
 * `termsUpdatedAt` is when the terms last changed: an acceptance older than it no longer
 * counts, so moving it forward sends every user back to `/terms` on their next page load.
 * Publish the new terms first, then move it: an acceptance stamped after it counts as current.
 *
 *   UPDATE app_config SET terms_updated_at = now(), updated_at = now();
 */
export const appConfig = pgTable(
  'app_config',
  {
    id: boolean('id').primaryKey().default(true),
    termsUpdatedAt: timestamp('terms_updated_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [check('app_config_singleton_check', sql`${table.id}`)]
);

/**
 * One row each time a user accepts the terms on `/terms`, never updated or deleted, so the
 * table is the record of who accepted and when. The newest row is the one compared against
 * `app_config.terms_updated_at`.
 */
export const termsAcceptance = pgTable(
  'terms_acceptance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('terms_acceptance_user_accepted_idx').on(table.userId, table.acceptedAt)]
);
