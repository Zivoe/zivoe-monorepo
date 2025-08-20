import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';

import { useBalance } from '@/hooks/useBalance';

export const useAvailableLiquidity = () => {
  return useBalance({
    tokenAddress: CONTRACTS.aUSDC,
    accountAddress: CONTRACTS.OCR
  });
};

export const availableLiquidityQueryKey = queryKeys.account.balanceOf({
  accountAddress: CONTRACTS.OCR,
  id: CONTRACTS.aUSDC
});
