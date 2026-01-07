import { CONTRACTS } from '@zivoe/contracts';

import { useAllowance } from '@/hooks/useAllowance';

export const useDepositAllowances = () => {
  const usdtAllowance = useAllowance({ contract: CONTRACTS.USDT, spender: CONTRACTS.zRTR });
  const zsttAllowance = useAllowance({ contract: CONTRACTS.zSTT, spender: CONTRACTS.zVLT });

  const isFetching = usdtAllowance.isFetching || zsttAllowance.isFetching;
  const isPending = usdtAllowance.isPending || zsttAllowance.isPending;
  const isError = usdtAllowance.isError || zsttAllowance.isError;

  const data = {
    USDT: usdtAllowance.data,
    zSTT: zsttAllowance.data
  };

  return { data, isPending, isFetching, isError };
};
