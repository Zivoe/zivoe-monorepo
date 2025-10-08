import { skipToken, useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

import { ocrInstantAbi } from '@zivoe/contracts/abis';

import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';

export const useRedemption = () => {
  const web3 = usePublicClient();

  return useQuery({
    queryKey: queryKeys.app.redemption,
    meta: { toastErrorMessage: 'Error fetching redemption info' },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    queryFn: !web3
      ? skipToken
      : async () => {
          const redemptionFeeBIPS = await web3.readContract({
            abi: ocrInstantAbi,
            address: CONTRACTS.OCR_Cycle,
            functionName: 'redemptionFeeBIPS'
          });

          return { redemptionFeeBIPS };
        }
  });
};
