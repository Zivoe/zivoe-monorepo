import { skipToken, useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { mockStablecoinAbi } from '@zivoe/contracts/abis';

import { queryKeys } from '@/lib/query-keys';

export const useAccountBalance = ({ address }: { address: Address }) => {
  const { address: accountAddress } = useAccount();
  const web3 = usePublicClient();

  const skip = !web3 || !accountAddress;

  return useQuery({
    queryKey: queryKeys.account.balanceOf({ accountAddress, id: address }),
    meta: { toastErrorMessage: 'Error fetching balance' },
    queryFn: skip
      ? skipToken
      : () => {
          return web3.readContract({
            abi: mockStablecoinAbi,
            address,
            functionName: 'balanceOf',
            args: [accountAddress]
          });
        }
  });
};
