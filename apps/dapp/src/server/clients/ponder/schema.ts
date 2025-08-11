import { index, onchainTable, relations } from 'ponder';

export const account = onchainTable('account', (t) => ({
  id: t.text().primaryKey()
}));

export const accountRelations = relations(account, ({ one, many }) => ({
  vestingSchedule: one(vestingSchedule, { fields: [account.id], references: [vestingSchedule.id] }),
  balances: many(tokenBalance),
  snapshots: many(balanceSnapshot)
}));

export const vestingSchedule = onchainTable('vesting_schedule', (t) => ({
  id: t.text().primaryKey(),
  start: t.bigint().notNull(),
  cliff: t.bigint().notNull(),
  end: t.bigint().notNull(),
  totalVesting: t.bigint().notNull(),
  totalWithdrawn: t.bigint().notNull(),
  vestingPerSecond: t.bigint().notNull(),
  revokable: t.boolean().notNull()
}));

export const tokenBalance = onchainTable(
  'token_balance',
  (t) => ({
    id: t.text().primaryKey(),
    accountId: t.text().notNull(),
    tokenAddress: t.text().notNull(),
    balance: t.bigint().notNull()
  }),
  (table) => ({
    tokenIdx: index().on(table.tokenAddress)
  })
);

export const tokenBalanceRelations = relations(tokenBalance, ({ one }) => ({
  account: one(account, { fields: [tokenBalance.accountId], references: [account.id] })
}));

export const balanceSnapshot = onchainTable(
  'balance_snapshot',
  (t) => ({
    id: t.text().primaryKey(),
    accountId: t.text().notNull(),
    tokenAddress: t.text().notNull(),
    balance: t.bigint().notNull(),
    timestamp: t.bigint().notNull()
  }),
  (table) => ({
    accountTokenIdx: index().on(table.accountId, table.tokenAddress)
  })
);

export const balanceSnapshotRelations = relations(balanceSnapshot, ({ one }) => ({
  account: one(account, { fields: [balanceSnapshot.accountId], references: [account.id] })
}));

export const occ = onchainTable('occ', (t) => ({
  id: t.text().primaryKey(),
  outstandingPrincipal: t.bigint().notNull(),
  totalRevenue: t.bigint().notNull()
}));

export const loan = onchainTable('loan', (t) => ({
  id: t.text().primaryKey(),
  borrowAmount: t.bigint().notNull()
}));
