import { skipToken, useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';
import { usePublicClient } from 'wagmi';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { queryKeys } from '@/lib/query-keys';

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

          const totalAssetsWei = parseUnits(totalAssets.toString(), 18);
          const indexPrice = totalSupply !== 0n ? Number(formatUnits(totalAssetsWei / totalSupply, 18)) : 0;

          return {
            totalSupply,
            totalAssets,
            indexPrice
          };
        }
  });
};
