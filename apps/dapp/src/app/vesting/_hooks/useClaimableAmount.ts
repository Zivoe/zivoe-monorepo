import { skipToken, useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeRewardsVestingAbi } from '@zivoe/contracts/abis';

import { queryKeys } from '@/lib/query-keys';

import { useAccount } from '@/hooks/useAccount';

export const useClaimableAmount = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: queryKeys.account.claimableVesting({ accountAddress: address }),
    queryFn:
      !address || !publicClient
        ? skipToken
        : async () => {
            const amount = await publicClient.readContract({
              address: CONTRACTS.vestZVE,
              abi: zivoeRewardsVestingAbi,
              functionName: 'amountWithdrawable',
              args: [address]
            });

            return amount;
          }
  });
};
