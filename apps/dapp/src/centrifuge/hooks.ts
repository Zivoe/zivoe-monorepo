'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';

import { useAccount } from '@/hooks/useAccount';

import { queryKeys } from '@/lib/query-keys';

import { getVault } from './client';
import { CENTRIFUGE_CONFIG } from './config';
import { readInvestment, readVaultCapacity } from './reads';

export function useVaultCapacity() {
  return useQuery({
    queryKey: queryKeys.app.vaultCapacity,
    meta: { toastErrorMessage: 'Error fetching vault capacity' },
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => readVaultCapacity(await getVault())
  });
}

const VAULT_PREVIEW_ABI = parseAbi(['function previewDeposit(uint256 assets) view returns (uint256 shares)']);

/**
 * The vault contract's own previewDeposit answer — the authoritative mint
 * quote, including whatever rounding the contract applies at execution.
 */
export function useDepositPreview({ assets }: { assets: bigint }) {
  const web3 = usePublicClient();

  return useQuery({
    queryKey: queryKeys.app.depositPreview({ assets }),
    meta: { skipErrorToast: true },
    queryFn:
      assets <= 0n || !web3
        ? skipToken
        : async () => ({
            shares: await web3.readContract({
              abi: VAULT_PREVIEW_ABI,
              address: CENTRIFUGE_CONFIG.vaultAddress,
              functionName: 'previewDeposit',
              args: [assets]
            })
          })
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
