import { Address } from 'viem';

import { Network } from '@zivoe/contracts';

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
  ],
  chainalysis: ({ accountAddress, network }: AccountProps & { network: Network | undefined }) => [
    ...account.by({ accountAddress }),
    network,
    'CHAINALYSIS'
  ],
  portfolio: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'PORTFOLIO'],
  vestingSchedule: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'VESTING_SCHEDULE'],
  claimableVesting: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'CLAIMABLE_VESTING']
};

const app = {
  vault: ['VAULT'],
  redemption: ['REDEMPTION'],
  blockchainTimestamp: ['BLOCKCHAIN_TIMESTAMP']
};

export const queryKeys = {
  account,
  app
};
