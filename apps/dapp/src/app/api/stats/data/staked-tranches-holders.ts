import 'server-only';

import { type Ponder } from '@/server/clients/ponder';

import { getTranchesHolders } from './tranches-holders-utils';

export const getStakedTranchesHolders = async ({ ponder }: { ponder: Ponder }) => {
  const positions = await ponder.query.stakingPosition.findMany({
    where: (stakingPosition, { gt }) => gt(stakingPosition.balance, 0n),
    columns: {
      accountId: true,
      type: true,
      balance: true
    }
  });

  return getTranchesHolders(positions);
};
