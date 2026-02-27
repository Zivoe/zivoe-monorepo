import { index, onchainTable, relations } from 'ponder';

export const account = onchainTable('account', (t) => ({
  id: t.text().primaryKey()
}));

export const accountRelations = relations(account, ({ one, many }) => ({
  vestingSchedule: one(vestingSchedule, { fields: [account.id], references: [vestingSchedule.id] }),
  balances: many(tokenBalance),
  snapshots: many(balanceSnapshot),
  stakingPositions: many(stakingPosition)
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

export const stakingPosition = onchainTable(
  'staking_position',
  (t) => ({
    id: t.text().primaryKey(),
    type: t.text().notNull(),
    accountId: t.text().notNull(),
    balance: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    lastUpdated: t.bigint().notNull()
  }),
  (table) => ({
    typeIdx: index().on(table.type)
  })
);

export const stakingPositionRelations = relations(stakingPosition, ({ one }) => ({
  account: one(account, { fields: [stakingPosition.accountId], references: [account.id] })
}));

export const deposit = onchainTable(
  'deposit',
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}:${logIndex}`
    accountId: t.text().notNull(), // User wallet address (owner from event)
    assets: t.bigint().notNull(), // zSTT amount deposited (ERC4626 assets)
    shares: t.bigint().notNull(), // zVLT shares received
    inputTokenAddress: t.text(), // Router input token address (stablecoin), null if unresolved
    inputAmountRaw: t.bigint(), // Router input amount (native decimals), null if unresolved
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.text().notNull(),
    logIndex: t.integer().notNull()
  }),
  (table) => ({
    accountIdx: index().on(table.accountId),
    blockLogIdx: index().on(table.blockNumber, table.logIndex)
  })
);

export const depositRelations = relations(deposit, ({ one }) => ({
  account: one(account, { fields: [deposit.accountId], references: [account.id] })
}));

// Redemption tracking for OCR_Cycle:zVLTBurnedForUSDC events
export const redemption = onchainTable(
  'redemption',
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}:${logIndex}`
    accountId: t.text().notNull(), // User wallet address
    zVLTBurned: t.bigint().notNull(), // zVLT amount burned
    usdcRedeemed: t.bigint().notNull(), // USDC amount received by user
    fee: t.bigint().notNull(), // Fee charged in USDC
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.text().notNull(),
    logIndex: t.integer().notNull()
  }),
  (table) => ({
    accountIdx: index().on(table.accountId),
    blockLogIdx: index().on(table.blockNumber, table.logIndex)
  })
);

export const redemptionRelations = relations(redemption, ({ one }) => ({
  account: one(account, { fields: [redemption.accountId], references: [account.id] })
}));
