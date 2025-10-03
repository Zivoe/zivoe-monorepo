import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';

import { useBalance } from '@/hooks/useBalance';

export const useAvailableLiquidity = () => {
  return useBalance({
    tokenAddress: CONTRACTS.aUSDC,
    accountAddress: CONTRACTS.OCR_Cycle
  });
};

export const availableLiquidityQueryKey = queryKeys.account.balanceOf({
  accountAddress: CONTRACTS.OCR_Cycle,
  id: CONTRACTS.aUSDC
});
