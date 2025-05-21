import { bigint, pgSchema, text } from 'drizzle-orm/pg-core';

export const schema = pgSchema('indexer');

export const occTable = schema.table('occ', {
  id: text('id').primaryKey(),
  outstandingPrincipal: bigint('outstanding_principal', { mode: 'bigint' }).notNull(),
  totalRevenue: bigint('total_revenue', { mode: 'bigint' }).notNull()
});
