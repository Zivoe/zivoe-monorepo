import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

/**
 * One row per user per agreements version they accepted (`/verification`'s Agreements step, or `/agreements` after
 * a new version), dated the first time; never updated or deleted by the app, so the table is the record of who
 * accepted which version and when. Deleting the user deletes their rows, as with the terms; one who signed a wallet
 * link cannot be deleted (the link's guard), and the link keeps its version. A person accepts for themselves: one
 * acceptance covers their own verification and every organization they act for, and each member of an organization
 * accepts on their own. The unique index turns a repeat (a double click, a second tab) into a no-op. The version in
 * force is the dapp's `LATEST_AGREEMENTS_VERSION`.
 */
export const agreementAcceptance = pgTable(
  'agreement_acceptance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agreementsVersion: text('agreements_version').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex('agreement_acceptance_user_version_idx').on(table.userId, table.agreementsVersion)]
);
