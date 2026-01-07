import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth-schema';

export const accountTypeEnum = pgEnum('account_type', ['individual', 'organization']);
export type AccountType = (typeof accountTypeEnum.enumValues)[number];

export const amountOfInterestValues = ['1k_10k', '10k_100k', '100k_250k', '250k_1m', 'over_1m'] as const;
export const amountOfInterestEnum = pgEnum('amount_of_interest', amountOfInterestValues);
export type AmountOfInterest = (typeof amountOfInterestValues)[number];

export const howFoundZivoeValues = [
  'x_twitter',
  'linkedin',
  'google_search',
  'media_coverage',
  'conference_event',
  'word_of_mouth',
  'other'
] as const;
export const howFoundZivoeEnum = pgEnum('how_found_zivoe', howFoundZivoeValues);
export type HowFoundZivoe = (typeof howFoundZivoeValues)[number];

export const profile = pgTable('profile', {
  id: uuid('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  // Personal required fields (set during onboarding)
  accountType: accountTypeEnum('account_type').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  amountOfInterest: amountOfInterestEnum('amount_of_interest').notNull(),
  howFoundZivoe: howFoundZivoeEnum('how_found_zivoe').notNull(),

  // Individual-specific
  countryOfResidence: text('country_of_residence'),

  // Organization-specific
  jobTitle: text('job_title'),
  entityName: text('entity_name'),
  countryOfIncorporation: text('country_of_incorporation'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export * from './auth-schema';
