import { skipToken } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { Address } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

export const useAllowance = ({ contract, spender }: { contract: Address; spender: Address }) => {
  const { address } = useAccount();
  const web3 = usePublicClient();

  const skip = !web3 || !address;

  return useQuery({
    queryKey: queryKeys.account.allowance({ accountAddress: address, contract, spender }),
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
        },
    placeholderData: 0n
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
