'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { BaseError, ContractFunctionRevertedError, parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';

import { queryKeys } from '@/lib/query-keys';

import { useAccount } from '@/hooks/useAccount';

import { getCentrifugeVault } from './client';
import { readCentrifugeVaultCapacity, readInvestorAccess, readRedemptionPosition } from './reads';
import { type TransactedCentrifugeVault } from './types';

/**
 * Whether this share class's Centrifuge vault admits the connected wallet, and
 * when it does not, why. Every flow's action gates on the verdicts: the
 * whitelist lives in the Centrifuge vault's own configuration, so a blocked
 * wallet's transaction reverts on-chain rather than failing any check the form
 * could run. The reason is copy only and never widens what the flows allow.
 * Skipped without a wallet — there is nothing to ask about until one connects.
 */
export function useInvestorAccess({ centrifugeVault }: { centrifugeVault: TransactedCentrifugeVault }) {
  const { address } = useAccount();
  const web3 = usePublicClient({ chainId: centrifugeVault.chainId });

  return useQuery({
    queryKey: queryKeys.account.investorAccess({
      accountAddress: address,
      shareClassKey: centrifugeVault.shareClass.key,
      chain: centrifugeVault.chain
    }),
    meta: { toastErrorMessage: 'Error checking wallet access' },
    queryFn:
      !address || !web3
        ? skipToken
        : async () =>
            readInvestorAccess({
              centrifugeVault: await getCentrifugeVault(centrifugeVault),
              investor: address,
              client: web3,
              // The catalog's token address — `pnpm centrifuge:verify` is the
              // manual pre-deploy check that it matches the Centrifuge vault's
              // own answer — so the hook reads off the token the flows transact with.
              shareTokenAddress: centrifugeVault.shareClass.shareTokenAddress
            })
  });
}

export function useCentrifugeVaultCapacity({ centrifugeVault }: { centrifugeVault: TransactedCentrifugeVault }) {
  return useQuery({
    queryKey: queryKeys.app.centrifugeVaultCapacity({
      shareClassKey: centrifugeVault.shareClass.key,
      chain: centrifugeVault.chain
    }),
    meta: { toastErrorMessage: 'Error fetching vault capacity' },
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => readCentrifugeVaultCapacity(await getCentrifugeVault(centrifugeVault))
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
export function useDepositPreview({
  centrifugeVault,
  assets
}: {
  centrifugeVault: TransactedCentrifugeVault;
  assets: bigint;
}) {
  const web3 = usePublicClient({ chainId: centrifugeVault.chainId });

  return useQuery({
    queryKey: queryKeys.app.depositPreview({
      shareClassKey: centrifugeVault.shareClass.key,
      chain: centrifugeVault.chain,
      assets
    }),
    meta: { skipErrorToast: true },
    queryFn:
      assets <= 0n || !web3
        ? skipToken
        : async () => ({
            shares: await web3.readContract({
              abi: CENTRIFUGE_VAULT_PREVIEW_ABI,
              address: centrifugeVault.address,
              functionName: 'previewDeposit',
              args: [assets]
            })
          })
  });
}

export function useRedemptionPosition({ centrifugeVault }: { centrifugeVault: TransactedCentrifugeVault }) {
  const { address } = useAccount();
  const web3 = usePublicClient({ chainId: centrifugeVault.chainId });

  return useQuery({
    queryKey: queryKeys.account.redemptionPosition({
      accountAddress: address,
      shareClassKey: centrifugeVault.shareClass.key,
      chain: centrifugeVault.chain
    }),
    meta: { toastErrorMessage: 'Error fetching redemption data' },
    // Cancellation Processing resolves without any user transaction (the hub
    // finishes the unwind), so the only wait state a user actively watches is
    // polled; every other transition refreshes through invalidations/focus.
    // An errored read also polls: focus refetch is off app-wide, and a failed
    // read renders like "no position" — the strips a user needs to claim or
    // cancel with are missing until it recovers on its own. An Unfunded Claim
    // deliberately does NOT poll: funding the escrow can take a while, and a
    // fresh load or the next transaction's refetch will pick it up.
    refetchInterval: ({ state }) =>
      state.status === 'error' ? 30 * 1000 : state.data?.hasPendingCancelRedeemRequest ? 10 * 1000 : false,
    queryFn:
      !address || !web3
        ? skipToken
        : async () =>
            readRedemptionPosition({
              centrifugeVault: await getCentrifugeVault(centrifugeVault),
              investor: address,
              client: web3,
              chain: centrifugeVault.chain,
              shareClassId: centrifugeVault.shareClass.scId,
              assetAddress: centrifugeVault.usdc.address
            })
  });
}
