import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { accountTypeValues, amountOfInterestValues, howFoundZivoeValues } from '../onboarding';
import { user } from './auth';

export * from '../onboarding';

export const accountTypeEnum = pgEnum('account_type', accountTypeValues);
export const amountOfInterestEnum = pgEnum('amount_of_interest', amountOfInterestValues);
export const howFoundZivoeEnum = pgEnum('how_found_zivoe', howFoundZivoeValues);

export const profile = pgTable('profile', {
  id: uuid('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountType: accountTypeEnum('account_type').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  amountOfInterest: amountOfInterestEnum('amount_of_interest').notNull(),
  howFoundZivoe: howFoundZivoeEnum('how_found_zivoe').notNull(),
  countryOfResidence: text('country_of_residence'),
  jobTitle: text('job_title'),
  entityName: text('entity_name'),
  countryOfIncorporation: text('country_of_incorporation'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
