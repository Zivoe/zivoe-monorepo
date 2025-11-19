import 'server-only';

import { Contracts } from '@zivoe/contracts';

import { type Ponder } from '@/server/clients/ponder';

import { type TrancheBalance, getTranchesHolders } from './tranches-holders-utils';

export const getTranchesTokenHolders = async ({ ponder, contracts }: { ponder: Ponder; contracts: Contracts }) => {
  const balances = await ponder.query.tokenBalance.findMany({
    where: (tokenBalance, { and, or, eq, gt }) =>
      and(
        or(
          eq(tokenBalance.tokenAddress, contracts.zSTT.toLowerCase()),
          eq(tokenBalance.tokenAddress, contracts.zJTT.toLowerCase())
        ),
        gt(tokenBalance.balance, 0n)
      ),
    columns: {
      accountId: true,
      tokenAddress: true,
      balance: true
    }
  });

  const entries: TrancheBalance[] = balances.map((balance) => ({
    accountId: balance.accountId,
    balance: balance.balance,
    type: balance.tokenAddress === contracts.zSTT.toLowerCase() ? 'senior' : 'junior'
  }));

  return getTranchesHolders(entries);
};
