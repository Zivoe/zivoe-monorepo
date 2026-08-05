'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { BaseError, ContractFunctionRevertedError, parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

import { useAccount } from '@/hooks/useAccount';

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

const VAULT_PREVIEW_ABI = parseAbi([
  'function previewDeposit(uint256 assets) view returns (uint256 shares)',
  'error InvalidPrice()'
]);

/** True when a preview failed because the vault has no valid Share Price (deposits unavailable). */
export function isPriceUnavailableError(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
  return revert instanceof ContractFunctionRevertedError && revert.data?.errorName === 'InvalidPrice';
}

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
    // Cancellation Processing resolves without any user transaction (the hub
    // finishes the unwind), so the only wait state a user actively watches is
    // polled; every other transition refreshes through invalidations/focus.
    refetchInterval: ({ state }) => (state.data?.hasPendingCancelRedeemRequest ? 10 * 1000 : false),
    queryFn: !address ? skipToken : async () => readInvestment({ vault: await getVault(), investor: address })
  });
}
