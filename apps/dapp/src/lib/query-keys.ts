import { type Address } from 'viem';

type AccountProps = {
  accountAddress?: Address;
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
  investment: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'INVESTMENT']
};

const app = {
  emailPreferences: ({ token }: { token?: string }) => ['EMAIL_PREFERENCES', token ?? 'session'],
  vaultCapacity: ['CENTRIFUGE', 'VAULT_CAPACITY'],
  depositPreview: ({ assets }: { assets: bigint }) => ['CENTRIFUGE', 'DEPOSIT_PREVIEW', assets.toString()],
  shareMetrics: ['CENTRIFUGE', 'SHARE_METRICS']
};

export const queryKeys = {
  account,
  app
};
