import { skipToken } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { type Address } from 'viem';
import { usePublicClient } from 'wagmi';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { getChainId } from '@/lib/chains';
import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

/** ERC-20 allowance on ONE chain — spender contracts (the VaultRouter) differ per chain. */
export const useAllowance = ({
  chain,
  contract,
  spender
}: {
  chain: CentrifugeChain;
  contract: Address;
  spender: Address;
}) => {
  const { address } = useAccount();
  const web3 = usePublicClient({ chainId: getChainId(chain) });

  const skip = !web3 || !address;

  return useQuery({
    queryKey: queryKeys.account.allowance({ accountAddress: address, chain, contract, spender }),
    meta: { toastErrorMessage: 'Error checking allowance' },
    queryFn: skip
      ? skipToken
      : () => {
          return web3.readContract({
            abi: erc20Abi,
            address: contract,
            functionName: 'allowance',
            args: [address, spender]
          });
        }
  });
};

export const checkHasEnoughAllowance = ({
  allowance,
  amount
}: {
  allowance: bigint | undefined;
  amount: bigint | undefined;
}) => {
  return allowance !== undefined && amount !== undefined && allowance >= amount;
};
