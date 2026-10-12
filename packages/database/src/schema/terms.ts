import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

/**
 * One row each time a user accepts the terms on `/terms`, never updated or deleted, so the table is
 * the record of who accepted which version and when. A user is current while they have a row for
 * `LATEST_LEGAL_DOCS_VERSION` (@zivoe/ui/lib/legal-docs), the version the deployed code requires.
 */
export const termsAcceptance = pgTable(
  'terms_acceptance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    termsVersion: text('terms_version').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('terms_acceptance_user_version_idx').on(table.userId, table.termsVersion)]
);
