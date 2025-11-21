import 'server-only';

import { formatUnits, getAddress } from 'viem';

import { type Contracts } from '@zivoe/contracts';

import { type Ponder } from '@/server/clients/ponder';

export type TokenHolder = {
  address: string;
  balance: string;
};

const ZVLT_DECIMALS = 18;

export const getZVLTTokenHolders = async ({ ponder, contracts }: { ponder: Ponder; contracts: Contracts }) => {
  const balances = await ponder.query.tokenBalance.findMany({
    where: (tokenBalance, { and, eq, gt }) =>
      and(eq(tokenBalance.tokenAddress, contracts.zVLT.toLowerCase()), gt(tokenBalance.balance, 0n)),
    columns: {
      accountId: true,
      balance: true
    },
    orderBy: (tokenBalance, { desc }) => desc(tokenBalance.balance)
  });

  const holders: TokenHolder[] = balances.map((balance) => ({
    address: getAddress(balance.accountId),
    balance: formatUnits(balance.balance, ZVLT_DECIMALS)
  }));

  return holders;
};
