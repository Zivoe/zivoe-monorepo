import { skipToken, useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

export const useVault = () => {
  const web3 = usePublicClient();

  return useQuery({
    queryKey: queryKeys.app.vault,
    meta: { toastErrorMessage: 'Error fetching vault data' },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    queryFn: !web3
      ? skipToken
      : async () => {
          const totalSupplyReq = web3.readContract({
            abi: zivoeVaultAbi,
            address: CONTRACTS.zVLT,
            functionName: 'totalSupply'
          });

          const totalAssetsReq = web3.readContract({
            abi: zivoeVaultAbi,
            address: CONTRACTS.zVLT,
            functionName: 'totalAssets'
          });

          const [totalSupply, totalAssets] = await Promise.all([totalSupplyReq, totalAssetsReq]);

          return {
            totalSupply,
            totalAssets
          };
        }
  });
};
