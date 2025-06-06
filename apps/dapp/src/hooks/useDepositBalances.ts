import { skipToken, useQuery } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';

import { DEPOSIT_TOKENS, DepositToken } from '@/types/constants';

import { queryKeys } from '@/lib/query-keys';

import { CONTRACTS } from '../lib/constants';

export const useDepositBalances = () => {
  const { address: accountAddress } = useAccount();
  const web3 = usePublicClient();

  const skip = !web3 || !accountAddress;

  return useQuery({
    queryKey: queryKeys.account.depositBalances({ accountAddress }),
    meta: { toastErrorMessage: 'Error getting deposit balances' },
    queryFn: skip
      ? skipToken
      : async () => {
          const balances = await Promise.all(
            DEPOSIT_TOKENS.map((token) => {
              return web3.readContract({
                abi: erc20Abi,
                address: CONTRACTS[token],
                functionName: 'balanceOf',
                args: [accountAddress]
              });
            })
          );

          const response: Record<DepositToken, bigint> = {
            USDC: balances[0] ?? 0n,
            USDT: balances[1] ?? 0n,
            frxUSD: balances[2] ?? 0n,
            zSTT: balances[3] ?? 0n
          };

          return response;
        }
  });
};
