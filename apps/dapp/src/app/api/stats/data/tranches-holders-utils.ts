import 'server-only';

import { formatUnits, getAddress } from 'viem';

import { ApiError } from '@/lib/utils';

export type TranchesHolder = {
  address: string;
  senior: string;
  junior: string;
};

export type TrancheBalance = {
  accountId: string;
  balance: bigint;
  type: string;
};

const DECIMALS = 18;

export const getTranchesHolders = (entries: TrancheBalance[]): TranchesHolder[] => {
  const holdersMap = new Map<string, TranchesHolder>();

  for (const entry of entries) {
    const address = getAddress(entry.accountId);
    const formattedBalance = formatUnits(entry.balance, DECIMALS);

    if (entry.type !== 'senior' && entry.type !== 'junior')
      throw new ApiError({ message: 'Invalid tranche type', status: 500 });

    const isSenior = entry.type === 'senior';
    const isJunior = entry.type === 'junior';

    const senior = isSenior ? formattedBalance : '0';
    const junior = isJunior ? formattedBalance : '0';

    if (!holdersMap.has(address)) {
      holdersMap.set(address, {
        address,
        senior,
        junior
      });
    } else {
      const holder = holdersMap.get(address)!;
      if (isSenior) holder.senior = formattedBalance;
      else if (isJunior) holder.junior = formattedBalance;
    }
  }

  return Array.from(holdersMap.values()).sort((a, b) => {
    const seniorDiff = parseFloat(b.senior) - parseFloat(a.senior);
    if (seniorDiff !== 0) return seniorDiff;

    return parseFloat(b.junior) - parseFloat(a.junior);
  });
};
