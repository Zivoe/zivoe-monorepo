import { skipToken, useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';

import { useAccount } from './useAccount';

export const useVault = () => {
  const { address: accountAddress } = useAccount();
  const web3 = usePublicClient();

  const skip = !web3 || !accountAddress;

  return useQuery({
    queryKey: queryKeys.app.vault,
    meta: { toastErrorMessage: 'Error fetching vault data' },
    refetchInterval: 60 * 1000, // 1 minute
    queryFn: skip
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
