import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth-schema';

export const profile = pgTable('profile', {
  id: uuid('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export * from './auth-schema';
