import { Address } from 'viem';

type AccountProps = {
  accountAddress?: Address;
};

const account = {
  by: ({ accountAddress }: AccountProps) => ['ACCOUNT', accountAddress],
  balance: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'BALANCE'],
  balanceOf: ({ accountAddress, id }: AccountProps & { id: Address }) => [...account.balance({ accountAddress }), id],
  depositBalances: ({ accountAddress }: AccountProps) => [...account.balance({ accountAddress }), 'DEPOSIT'],
  allowance: ({ accountAddress, contract, spender }: AccountProps & { contract: Address; spender: Address }) => [
    ...account.by({ accountAddress }),
    'ALLOWANCE',
    contract,
    spender
  ]
};

const app = {
  vault: ['VAULT']
};

export const queryKeys = {
  account,
  app
};
