import { CONTRACTS } from '@/lib/constants';

import { useAllowance } from '@/hooks/useAllowance';

export const useDepositAllowances = () => {
  const usdcAllowance = useAllowance({ contract: CONTRACTS.USDC, spender: CONTRACTS.zRTR });
  const usdtAllowance = useAllowance({ contract: CONTRACTS.USDT, spender: CONTRACTS.zRTR });
  const frxAllowance = useAllowance({ contract: CONTRACTS.FRX, spender: CONTRACTS.zRTR });
  const zsttAllowance = useAllowance({ contract: CONTRACTS.zSTT, spender: CONTRACTS.zVLT });

  const isFetching =
    usdcAllowance.isFetching || usdtAllowance.isFetching || frxAllowance.isFetching || zsttAllowance.isFetching;

  const isPending =
    usdcAllowance.isPending || usdtAllowance.isPending || frxAllowance.isPending || zsttAllowance.isPending;

  const isError = usdcAllowance.isError || usdtAllowance.isError || frxAllowance.isError || zsttAllowance.isError;

  const data = {
    USDC: usdcAllowance.data,
    USDT: usdtAllowance.data,
    FRX: frxAllowance.data,
    zSTT: zsttAllowance.data
  };

  return { data, isPending, isFetching, isError };
};
