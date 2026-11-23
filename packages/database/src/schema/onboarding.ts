import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { amountOfInterestValues, howFoundZivoeValues } from '../onboarding';
import { user } from './auth';

export * from '../onboarding';

export const amountOfInterestEnum = pgEnum('amount_of_interest', amountOfInterestValues);
export const howFoundZivoeEnum = pgEnum('how_found_zivoe', howFoundZivoeValues);

export const profile = pgTable('profile', {
  id: uuid('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  amountOfInterest: amountOfInterestEnum('amount_of_interest').notNull(),
  howFoundZivoe: howFoundZivoeEnum('how_found_zivoe').notNull(),
  /** Null for someone who onboarded as an organization before the two were apart; they answer at verification. */
  countryOfResidence: text('country_of_residence'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
