import { type Address } from 'viem';

import { type ShareClassKey } from '@zivoe/centrifuge-indexer';

type AccountProps = {
  accountAddress?: Address;
};

type ShareClassProps = {
  shareClassKey: ShareClassKey;
};

const account = {
  by: ({ accountAddress }: AccountProps) => ['ACCOUNT', accountAddress],
  balance: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'BALANCE'],
  balanceOf: ({ accountAddress, id }: AccountProps & { id: Address }) => [...account.balance({ accountAddress }), id],
  allowance: ({ accountAddress, contract, spender }: AccountProps & { contract: Address; spender: Address }) => [
    ...account.by({ accountAddress }),
    'ALLOWANCE',
    contract,
    spender
  ],
  chainalysis: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'CHAINALYSIS'],
  portfolio: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'PORTFOLIO'],
  investment: ({ accountAddress, shareClassKey }: AccountProps & ShareClassProps) => [
    ...account.by({ accountAddress }),
    'INVESTMENT',
    shareClassKey
  ],
  /** Every share class's investment state for the account — the invalidation prefix. */
  investments: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'INVESTMENT']
};

const app = {
  emailPreferences: ({ token }: { token?: string }) => ['EMAIL_PREFERENCES', token ?? 'session'],
  vaultCapacity: ({ shareClassKey }: ShareClassProps) => ['CENTRIFUGE', shareClassKey, 'VAULT_CAPACITY'],
  depositPreview: ({ shareClassKey, assets }: ShareClassProps & { assets: bigint }) => [
    'CENTRIFUGE',
    shareClassKey,
    'DEPOSIT_PREVIEW',
    assets.toString()
  ],
  shareMetrics: ({ shareClassKey }: ShareClassProps) => ['CENTRIFUGE', shareClassKey, 'SHARE_METRICS']
};

export const queryKeys = {
  account,
  app
};
