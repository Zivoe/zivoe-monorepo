import { skipToken, useQuery } from '@tanstack/react-query';
import { type Address, erc20Abi } from 'viem';
import { usePublicClient } from 'wagmi';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { getChainId } from '@/lib/network';
import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

/**
 * ERC-20 balance of `accountAddress` on ONE chain, defaulting to the
 * connected wallet when omitted. The chain is explicit because one token
 * address can exist on several chains with independent balances.
 */
export const useBalance = ({
  chain,
  tokenAddress,
  accountAddress
}: {
  chain: CentrifugeChain;
  tokenAddress: Address;
  accountAddress?: Address;
}) => {
  const { address: connectedAddress } = useAccount();
  const web3 = usePublicClient({ chainId: getChainId(chain) });

  const holder = accountAddress ?? connectedAddress;
  const skip = !web3 || !holder;

  return useQuery({
    queryKey: queryKeys.account.balanceOf({ accountAddress: holder, chain, id: tokenAddress }),
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
