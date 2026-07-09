import { skipToken, useQuery } from '@tanstack/react-query';
import { type Address, erc20Abi } from 'viem';
import { usePublicClient } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

/** ERC-20 balance of `accountAddress`, defaulting to the connected wallet when omitted. */
export const useBalance = ({ tokenAddress, accountAddress }: { tokenAddress: Address; accountAddress?: Address }) => {
  const { address: connectedAddress } = useAccount();
  const web3 = usePublicClient();

  const holder = accountAddress ?? connectedAddress;
  const skip = !web3 || !holder;

  return useQuery({
    queryKey: queryKeys.account.balanceOf({ accountAddress: holder, id: tokenAddress }),
    meta: { toastErrorMessage: 'Error fetching balance' },
    queryFn: skip
      ? skipToken
      : () => {
          return web3.readContract({
            abi: erc20Abi,
            address: tokenAddress,
            functionName: 'balanceOf',
            args: [holder]
          });
        }
  });
};
