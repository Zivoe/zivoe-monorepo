'use client';

import { queryOptions, skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { type Address, BaseError, ContractFunctionRevertedError, parseAbi } from 'viem';
import { useConfig, usePublicClient } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';

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
 *
 * Keyed per chain, not per Centrifuge vault: every verdict is a fact of the
 * SHARE token's transfer hook, identical for every vault on the chain.
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
      chain: centrifugeVault.chain,
      centrifugeVaultAddress: centrifugeVault.address
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
      centrifugeVaultAddress: centrifugeVault.address,
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

/**
 * A Redemption Position re-reads on its own only while its last read failed:
 * focus refetch is off app-wide, and a failed read renders like "no position",
 * hiding the strips a user needs to claim or cancel with. Backs off from 30s,
 * doubling to five minutes, since every vault of every chain is read on every
 * page load and a chain whose RPC is down would otherwise be hit every half
 * minute. A failed refetch with an earlier answer cached retries too: after a
 * transaction that answer is stale. Nothing else polls — not a Cancellation
 * Processing (the hub's unwind can sit for a long while) and not an Unfunded
 * Claim (funding the escrow can take a while); every other transition
 * refreshes through the user's own transactions.
 */
export function redemptionPositionRefetchInterval(state: {
  status: 'pending' | 'error' | 'success';
  errorUpdateCount: number;
}): number | false {
  if (state.status === 'error')
    return Math.min(30 * 1000 * 2 ** Math.max(0, state.errorUpdateCount - 1), 5 * 60 * 1000);
  return false;
}

/**
 * The one Redemption Position query, shared by the single- and the many-vault
 * readers so both hit one cache entry per vault. A failed read never toasts:
 * the many-vault reader runs for every chain on every page load, and one flaky
 * RPC would otherwise toast per chain; the surfaces that read a position say
 * in place when it could not be loaded.
 */
function redemptionPositionQueryOptions({
  centrifugeVault,
  address,
  web3
}: {
  centrifugeVault: TransactedCentrifugeVault;
  address: `0x${string}` | undefined;
  web3: ReturnType<typeof usePublicClient>;
}) {
  return queryOptions({
    queryKey: queryKeys.account.redemptionPosition({
      accountAddress: address,
      shareClassKey: centrifugeVault.shareClass.key,
      chain: centrifugeVault.chain,
      centrifugeVaultAddress: centrifugeVault.address
    }),
    meta: { skipErrorToast: true },
    // The Pending tab and the redeem form mount and unmount each other, and
    // each mount must not re-read nine chains; invalidations bypass this.
    staleTime: 30 * 1000,
    refetchInterval: ({ state }) => redemptionPositionRefetchInterval(state),
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
              assetAddress: centrifugeVault.asset.address
            })
  });
}

export function useRedemptionPosition({ centrifugeVault }: { centrifugeVault: TransactedCentrifugeVault }) {
  const { address } = useAccount();
  const web3 = usePublicClient({ chainId: centrifugeVault.chainId });

  return useQuery(redemptionPositionQueryOptions({ centrifugeVault, address, web3 }));
}

/**
 * The wallet's Redemption Position in every given Centrifuge vault, one result
 * per vault in the given order; the same query as useRedemptionPosition.
 */
export function useRedemptionPositions({
  centrifugeVaults,
  accountAddress
}: {
  centrifugeVaults: ReadonlyArray<TransactedCentrifugeVault>;
  accountAddress?: Address;
}) {
  const { address: connectedAddress } = useAccount();
  const address = accountAddress ?? connectedAddress;
  const config = useConfig();

  return useQueries({
    queries: centrifugeVaults.map((centrifugeVault) =>
      redemptionPositionQueryOptions({
        centrifugeVault,
        address,
        // usePublicClient reads one chain per call; the action form resolves each vault's own.
        web3: getPublicClient(config, { chainId: centrifugeVault.chainId })
      })
    )
  });
}
