import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';
import { verificationSubject } from './organizations';

/**
 * A Verification subject's acceptance of the agreements, on `/verification`'s Agreements step: one
 * row per subject, written the first time and never updated, so a repeat (a double click, a second member of
 * an organization) is a no-op. For an organization, `acceptedByUserId` is the member who accepted on its
 * behalf; null once they delete their account. A subject without a row cannot start its Persona inquiry.
 */
export const agreementAcceptance = pgTable('agreement_acceptance', {
  subjectId: uuid('subject_id')
    .primaryKey()
    .references(() => verificationSubject.id, { onDelete: 'cascade' }),
  acceptedByUserId: uuid('accepted_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow()
});
