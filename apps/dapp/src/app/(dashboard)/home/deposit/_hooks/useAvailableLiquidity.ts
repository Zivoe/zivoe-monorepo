import { CONTRACTS } from '@zivoe/contracts';

import { queryKeys } from '@/lib/query-keys';

import { useBalance } from '@/hooks/useBalance';

export const useAvailableLiquidity = () => {
  return useBalance({
    tokenAddress: CONTRACTS.USDC,
    accountAddress: CONTRACTS.OCR_CycleV2
  });
};

export const availableLiquidityQueryKey = queryKeys.account.balanceOf({
  accountAddress: CONTRACTS.OCR_CycleV2,
  id: CONTRACTS.USDC
});
