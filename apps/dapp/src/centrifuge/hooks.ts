'use client';

import { skipToken, useQuery } from '@tanstack/react-query';

import { useAccount } from '@/hooks/useAccount';

import { queryKeys } from '@/lib/query-keys';

import { getVault, readPreviewDeposit } from './client';
import { readInvestment, readVaultCapacity } from './reads';

export function useVaultCapacity() {
  return useQuery({
    queryKey: queryKeys.app.vaultCapacity,
    meta: { toastErrorMessage: 'Error fetching vault capacity' },
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => readVaultCapacity(await getVault())
  });
}

export function useDepositPreview({ assets }: { assets: bigint }) {
  return useQuery({
    queryKey: queryKeys.app.depositPreview({ assets }),
    meta: { skipErrorToast: true },
    queryFn: assets <= 0n ? skipToken : async () => ({ shares: await readPreviewDeposit(assets) })
  });
}

export function useInvestment() {
  const { address } = useAccount();

  return useQuery({
    queryKey: queryKeys.account.investment({ accountAddress: address }),
    meta: { toastErrorMessage: 'Error fetching investment data' },
    queryFn: !address ? skipToken : async () => readInvestment({ vault: await getVault(), investor: address })
  });
}
