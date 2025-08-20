import { skipToken, useQuery } from '@tanstack/react-query';
import { Address, erc20Abi } from 'viem';
import { usePublicClient } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

export const useBalance = ({ tokenAddress, accountAddress }: { tokenAddress: Address; accountAddress: Address }) => {
  const web3 = usePublicClient();
  const skip = !web3;

  return useQuery({
    queryKey: queryKeys.account.balanceOf({ accountAddress, id: tokenAddress }),
    meta: { toastErrorMessage: 'Error fetching balance' },
    queryFn: skip
      ? skipToken
      : () => {
          return web3.readContract({
            abi: erc20Abi,
            address: tokenAddress,
            functionName: 'balanceOf',
            args: [accountAddress]
          });
        }
  });
};
