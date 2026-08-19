'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { BaseError, ContractFunctionRevertedError, parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

import { useAccount } from '@/hooks/useAccount';

import { getCentrifugeVault } from './client';
import { readCentrifugeVaultCapacity, readInvestorWhitelist, readRedemptionPosition } from './reads';
import { type TransactedShareClass } from './types';

/**
 * Whether this share class's Centrifuge vault admits the connected wallet. Every flow's
 * action gates on it: the whitelist lives in the Centrifuge vault's own configuration,
 * so a blocked wallet's transaction reverts on-chain rather than failing any
 * check the form could run. Skipped without a wallet — there is nothing to
 * ask about until one connects.
 */
export function useInvestorWhitelist({ shareClass }: { shareClass: TransactedShareClass }) {
  const { address } = useAccount();

  return useQuery({
    queryKey: queryKeys.account.investorWhitelist({
      accountAddress: address,
      shareClassKey: shareClass.key,
      chain: shareClass.chain
    }),
    meta: { toastErrorMessage: 'Error checking wallet access' },
    queryFn: !address
      ? skipToken
      : async () => readInvestorWhitelist({ centrifugeVault: await getCentrifugeVault(shareClass), investor: address })
  });
}

export function useCentrifugeVaultCapacity({ shareClass }: { shareClass: TransactedShareClass }) {
  return useQuery({
    queryKey: queryKeys.app.centrifugeVaultCapacity({ shareClassKey: shareClass.key, chain: shareClass.chain }),
    meta: { toastErrorMessage: 'Error fetching vault capacity' },
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => readCentrifugeVaultCapacity(await getCentrifugeVault(shareClass))
  });
}

const CENTRIFUGE_VAULT_PREVIEW_ABI = parseAbi([
  'function previewDeposit(uint256 assets) view returns (uint256 shares)',
  'error InvalidPrice()'
]);

/** True when a preview failed because the Centrifuge vault has no valid Share Price (deposits unavailable). */
export function isPriceUnavailableError(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
  return revert instanceof ContractFunctionRevertedError && revert.data?.errorName === 'InvalidPrice';
}

/**
 * The Centrifuge vault contract's own previewDeposit answer — the authoritative mint
 * quote, including whatever rounding the contract applies at execution.
 */
export function useDepositPreview({ shareClass, assets }: { shareClass: TransactedShareClass; assets: bigint }) {
  const web3 = usePublicClient({ chainId: shareClass.chainId });

  return useQuery({
    queryKey: queryKeys.app.depositPreview({ shareClassKey: shareClass.key, chain: shareClass.chain, assets }),
    meta: { skipErrorToast: true },
    queryFn:
      assets <= 0n || !web3
        ? skipToken
        : async () => ({
            shares: await web3.readContract({
              abi: CENTRIFUGE_VAULT_PREVIEW_ABI,
              address: shareClass.centrifugeVaultAddress,
              functionName: 'previewDeposit',
              args: [assets]
            })
          })
  });
}

export function useRedemptionPosition({ shareClass }: { shareClass: TransactedShareClass }) {
  const { address } = useAccount();

  return useQuery({
    queryKey: queryKeys.account.redemptionPosition({
      accountAddress: address,
      shareClassKey: shareClass.key,
      chain: shareClass.chain
    }),
    meta: { toastErrorMessage: 'Error fetching redemption data' },
    // Cancellation Processing resolves without any user transaction (the hub
    // finishes the unwind), so the only wait state a user actively watches is
    // polled; every other transition refreshes through invalidations/focus.
    // An errored read also polls: focus refetch is off app-wide, and a failed
    // read renders like "no position" — the strips a user needs to claim or
    // cancel with are missing until it recovers on its own.
    refetchInterval: ({ state }) =>
      state.status === 'error' ? 30 * 1000 : state.data?.hasPendingCancelRedeemRequest ? 10 * 1000 : false,
    queryFn: !address
      ? skipToken
      : async () => readRedemptionPosition({ centrifugeVault: await getCentrifugeVault(shareClass), investor: address })
  });
}
