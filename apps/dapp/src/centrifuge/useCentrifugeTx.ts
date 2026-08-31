'use client';

import { type QueryClient } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import { type Address, type TransactionReceipt } from 'viem';
import { useConfig, usePublicClient } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';

import { toast } from '@zivoe/ui/core/sonner';

import { getViemChain, waitForRpcCatchup } from '@/lib/chains';
import {
  type NativeCurrency,
  insufficientNativeFundsError,
  isInsufficientNativeFundsError
} from '@/lib/native-funds';
import { queryKeys } from '@/lib/query-keys';
import { AppError, handlePromise } from '@/lib/utils';

import useTxLifecycle, { type TxSharedConfig, toSentryExtras } from '@/hooks/useTxLifecycle';

import { getCentrifugeVault, setTransactionSigner } from './client';
import { type CentrifugeVaultEntity, type TransactionEntity } from './entities';
import { type ExpectedContractCall, type SimulationErrorCopy, createSimulationSigner } from './simulate';
import { type TransactionIdentity } from './types';

type PublicClient = NonNullable<ReturnType<typeof usePublicClient>>;

/**
 * Bounds only the wait for a wallet signature. A request that never settles
 * (e.g. a dead WalletConnect session) would otherwise hold the module-level
 * signer lock until reload, bricking every other flow with "Another
 * transaction is already in progress". Once a hash exists the chain settles
 * the outcome, so confirmation itself is never timed out.
 */
const SIGNING_TIMEOUT_MS = 5 * 60_000;

type CentrifugeTxContext = { address: Address; centrifugeVault: CentrifugeVaultEntity; publicClient: PublicClient };

/** Wallet-connected clients resolved by the pre-started guards. */
type CentrifugeClients = { address: Address; publicClient: PublicClient };

export type CentrifugeTxConfig<TVariables> = Omit<
  TxSharedConfig<TVariables>,
  'invalidate' | 'zivoeVaultSlug' | 'chain'
> & {
  /** The Zivoe Vault identity this transaction runs against — Centrifuge vault, tokens, analytics slug. */
  identity: TransactionIdentity;
  /**
   * Flow-specific invalidations beyond the driver's share-class-scoped set —
   * every Centrifuge transaction already invalidates balances, redemption
   * position, portfolio and share metrics for the transacted class.
   */
  invalidateExtra?: (ctx: { queryClient: QueryClient; address: Address | undefined; vars: TVariables }) => void;
  /**
   * Re-runs guards and starts the SDK action; throw AppError for validation
   * failures. Runs with the lazily resolved, simulation-wrapped signer already
   * installed on the SDK client. The transaction must be returned wrapped as
   * `{ tx }`: the SDK Transaction is also a PromiseLike, so returning it bare
   * through an await would execute it to completion with no subscriber.
   */
  action: (
    vars: TVariables,
    ctx: CentrifugeTxContext
  ) => { tx: TransactionEntity } | Promise<{ tx: TransactionEntity }>;
  /**
   * Optional final assertion over the SDK's fully built router call. Use when
   * one SDK action can select between semantically different operations.
   */
  expectedCall?: (vars: TVariables, ctx: CentrifugeTxContext) => ExpectedContractCall;
  /** Decoded protocol error names mapped to flow-specific copy for the simulation block. */
  simulationErrorCopy: SimulationErrorCopy;
  /** SDK plain pre-signature error messages (matched by inclusion) mapped to product copy. */
  sdkErrorCopy?: Record<string, string>;
};

/**
 * Centrifuge SDK driver for the shared transaction lifecycle in
 * useTxLifecycle: same choreography as useTx, but the receipt comes from the
 * SDK action observed through its status Observable, with simulate-before-sign
 * enforced at the EIP-1193 signer boundary.
 */
export default function useCentrifugeTx<TVariables>(config: CentrifugeTxConfig<TVariables>) {
  const wagmiConfig = useConfig();

  const { identity, analytics } = config;
  const nativeCurrency = getViemChain(identity.centrifugeVault.chain).nativeCurrency;

  // Pinned to the identity's chain: simulation, receipt fallbacks and reads
  // must run where the Centrifuge vault lives, not wherever the wallet
  // happens to be.
  const publicClient = usePublicClient({ chainId: identity.centrifugeVault.chainId });

  return useTxLifecycle({
    ...config,

    // The Zivoe Vault slug rides every analytics event, and the lifecycle
    // derives the Sentry tag/extra from `zivoeVaultSlug` below — the driver
    // adds only what the lifecycle cannot know: the share-class key.
    analytics: analytics && {
      ...analytics,
      input: (vars, ctx) => ({ ...analytics.input(vars, ctx), zivoeVaultSlug: identity.zivoeVaultSlug })
    },
    sentryExtras: (vars) => ({
      ...(config.sentryExtras ?? toSentryExtras)(vars),
      shareClassKey: identity.centrifugeVault.shareClass.key,
      chain: identity.centrifugeVault.chain
    }),

    // The payload's slug and chain are stamped by the lifecycle itself,
    // uniformly for both drivers (approvals included) and for the fallback
    // payload.
    zivoeVaultSlug: identity.zivoeVaultSlug,
    chain: identity.centrifugeVault.chain,

    // Every Centrifuge transaction moves share-class-scoped state, so the
    // driver owns the invalidation — stamped once here (like the slug above)
    // instead of copy-pasted into every hook; hooks add flow extras only.
    invalidate: (ctx) => {
      invalidateAfterCentrifugeTx({
        queryClient: ctx.queryClient,
        address: ctx.address,
        shareClassKey: identity.centrifugeVault.shareClass.key
      });
      config.invalidateExtra?.(ctx);
    },

    normalizeError: (err) => normalizeCentrifugeError({ err, nativeCurrency, sdkErrorCopy: config.sdkErrorCopy }),

    prepare: (_vars, { address }): CentrifugeClients => {
      if (!address) throw new AppError({ message: 'Wallet not connected' });
      if (!publicClient) throw new Error('Public client not found');

      return { address, publicClient };
    },

    send: async (vars, { address, publicClient }, { choreography, capture, onTxHash, setIsTxPending }) => {
      let txHash: string | undefined;
      let pendingToastId: string | number | undefined;
      let releaseSigner: (() => void) | undefined;
      let subscription: { unsubscribe(): void } | undefined;
      let signingTimeout: ReturnType<typeof setTimeout> | undefined;

      // The lifecycle's failure captures must point at the same transaction
      // the fallback logic below reasons about.
      const updateTxHash = (hash: string | undefined) => {
        txHash = hash;
        onTxHash(hash);
      };

      try {
        const centrifugeVault = await getCentrifugeVault(identity.centrifugeVault);
        const txContext = { address, centrifugeVault, publicClient };

        // Lazy signer resolution: the current wallet client is fetched per
        // transaction, so an account switch can never leave a stale signer.
        // Requested for the identity's chain — the CTA gates on the wallet
        // already sitting there, and the SDK re-asserts before submitting.
        const { err: walletErr, res: walletClient } = await handlePromise(
          getWalletClient(wagmiConfig, { chainId: identity.centrifugeVault.chainId })
        );
        if (walletErr || !walletClient) throw normalizeWalletClientError(walletErr);

        const signer = createSimulationSigner({
          walletClient,
          simulationClient: publicClient,
          errorCopy: config.simulationErrorCopy,
          nativeCurrency,
          expectedCall: config.expectedCall?.(vars, txContext)
        });
        releaseSigner = setTransactionSigner(signer);

        const { tx: transaction } = await config.action(vars, txContext);

        const receipt = await new Promise<TransactionReceipt>((resolve, reject) => {
          let confirmed: TransactionReceipt | undefined;

          // Armed per signing step; a late timer is a no-op once a hash
          // arrived, and a settled promise ignores the reject anyway. The
          // timeout means "gave up waiting", not "did not happen": a wallet
          // request cannot be cancelled, so a late approval may still
          // broadcast — refetch stays on so balances self-correct, and the
          // copy warns against blindly retrying.
          const armSigningTimeout = () => {
            clearTimeout(signingTimeout);
            signingTimeout = setTimeout(() => {
              if (!txHash)
                reject(
                  new AppError({
                    message:
                      'Your wallet did not respond. If you approved the transaction in your wallet, wait for it to land before trying again.',
                    type: 'warning'
                  })
                );
            }, SIGNING_TIMEOUT_MS);
          };
          armSigningTimeout();

          subscription = transaction.subscribe({
            next: (status) => {
              // A multi-transaction action (e.g. the SDK's approve + invest)
              // reuses this observer: drop the previous step's hash as soon as
              // the next step starts signing, so the chain fallback below can
              // never resolve an earlier step's receipt as this action's outcome.
              if (status.type === 'SigningTransaction') {
                updateTxHash(undefined);
                armSigningTimeout();
              }

              // Message signatures (the SDK's permit path, disabled today) can
              // hang the same way a transaction signature can.
              if (status.type === 'SigningMessage') armSigningTimeout();

              if (status.type === 'TransactionPending' && status.hash) {
                clearTimeout(signingTimeout);
                updateTxHash(status.hash);
                setIsTxPending(true);
                if (pendingToastId !== undefined) sonnerToast.dismiss(pendingToastId);
                pendingToastId = toast({ type: 'pending', title: config.pendingToast(vars) });
                capture(choreography?.submitted, { txHash });
              }

              if (status.type === 'TransactionConfirmed') confirmed = status.receipt;
            },
            // The SDK throws instead of emitting a reverted receipt; resolving
            // with that receipt routes on-chain failures to the transaction
            // dialog, matching useTx.
            error: (err) => {
              const receipt = extractRevertedReceipt(err);
              if (receipt) {
                resolve(receipt);
                return;
              }

              // The SDK's error can be displaced before it carries the receipt
              // out (e.g. Next's dev log forwarder throws serializing the
              // receipt the SDK console.errors), so once a hash is known the
              // chain is the source of truth. Costs one read, only here. But a
              // hash pointing at an already-confirmed earlier step (the approve
              // of a two-transaction action) proves the failing transaction is
              // a different one — fetching that receipt would report this
              // failure as a success.
              if (!txHash || txHash === confirmed?.transactionHash) {
                reject(toRejectionError(err));
                return;
              }

              void handlePromise(publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })).then(
                ({ res }) => (res ? resolve(res) : reject(toRejectionError(err)))
              );
            },
            complete: () =>
              confirmed ? resolve(confirmed) : reject(new Error('Transaction stream completed without a receipt'))
          });
        });

        // Same pending-phase hold as useTx's receipt wait: on the Base chains
        // the receipt can precede readable state, so keep the pending toast up
        // (the finally below dismisses it) until the RPC catches up before the
        // dialog opens and the lifecycle refetches. Chains without a catch-up
        // margin resolve immediately.
        await waitForRpcCatchup({
          client: publicClient,
          chainId: identity.centrifugeVault.chainId,
          receiptBlock: receipt.blockNumber
        });

        return receipt;
      } finally {
        // Nothing outlives the mutation: not the timer, not the observer
        // (unsubscribed before the lock frees, so no callback can race a
        // successor transaction), not the signer lock.
        clearTimeout(signingTimeout);
        subscription?.unsubscribe();
        releaseSigner?.();
        setIsTxPending(false);
        if (pendingToastId !== undefined) sonnerToast.dismiss(pendingToastId);
      }
    }
  });
}

/**
 * Invalidated after every settled Centrifuge tx, scoped to the transacted
 * share class. Stats included: NAV moves with issuance as soon as the indexer
 * processes the block.
 */
export function invalidateAfterCentrifugeTx({
  queryClient,
  address,
  shareClassKey
}: {
  queryClient: QueryClient;
  address: Address | undefined;
  shareClassKey: string;
}) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.account.balance({ accountAddress: address }) });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.account.redemptionPositions({ accountAddress: address, shareClassKey })
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.account.portfolio({ accountAddress: address }) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.app.shareMetrics({ shareClassKey }) });
}

/**
 * The SDK's TransactionError (thrown on a reverted receipt instead of emitting
 * TransactionConfirmed) is not exported, so it is recognized by the receipt it
 * carries.
 */
function extractRevertedReceipt(err: unknown): TransactionReceipt | undefined {
  if (!(err instanceof Error) || !('receipt' in err)) return undefined;

  const receipt = err.receipt as TransactionReceipt | undefined;
  return receipt?.status === 'reverted' && typeof receipt.transactionHash === 'string' ? receipt : undefined;
}

/**
 * The SDK's Observable types its error as `unknown`. That value has to reach
 * normalizeCentrifugeError intact — findAppError walks its cause chain for the
 * simulation's AppError, and the copy matching reads its message — so Errors
 * pass straight through and only a non-Error is boxed, keeping the original as
 * `cause`. Rejecting with the bare `unknown` would trip prefer-promise-reject-errors.
 */
function toRejectionError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err), { cause: err });
}

/**
 * The SDK signs through a viem walletClient, whose transport wraps any error
 * thrown by our simulation signer (TransactionExecutionError → UnknownRpcError
 * → AppError), so the simulation's AppError surfaces on the cause chain, not
 * as the top-level error.
 */
function findAppError(err: unknown): AppError | undefined {
  for (
    let current = err, depth = 0;
    current instanceof Error && depth < 10;
    current = current.cause as Error, depth++
  ) {
    if (current instanceof AppError) return current;
  }
  return undefined;
}

/**
 * getWalletClient fails for more than a missing connection: wagmi re-reads
 * the connector's LIVE chain and throws a mismatch when it drifted from the
 * requested one between the CTA's gate and the click — 'Wallet not connected'
 * on a plainly-connected wallet would mislead both the user and Sentry.
 * (A wallet on a chain outside the app's allow-list never reaches here:
 * Dynamic's networkValidationMode overlay intercepts it first.)
 */
function normalizeWalletClientError(err: unknown): AppError {
  const isChainMismatch = err instanceof Error && err.name === 'ConnectorChainMismatchError';
  return new AppError({
    message: isChainMismatch
      ? 'Your wallet is connected to the wrong network. Switch networks and try again.'
      : 'Wallet not connected',
    exception: err
  });
}

function normalizeCentrifugeError({
  err,
  nativeCurrency,
  sdkErrorCopy
}: {
  err: unknown;
  nativeCurrency: NativeCurrency;
  sdkErrorCopy?: Record<string, string>;
}): unknown {
  const appError = findAppError(err);
  if (appError) return appError;

  if (err instanceof Error && err.message.includes('User rejected the request'))
    return new AppError({
      message: 'Transaction rejected',
      exception: err,
      refetch: false,
      type: 'warning',
      capture: false
    });

  // Send-path funding failures the simulation cannot see: the wallet or
  // txpool rejects for gas the eth_call never charged. The node's message is
  // authoritative about the sender, so no balance confirmation is needed here.
  if (isInsufficientNativeFundsError(err)) return insufficientNativeFundsError({ nativeCurrency, exception: err });

  // The SDK's ChainMismatchError — flow-agnostic, so mapped here instead of in
  // every flow's sdkErrorCopy.
  if (err instanceof Error && err.message.includes('Refusing to submit to avoid sending funds on the wrong network'))
    return new AppError({
      message: 'Your wallet is connected to the wrong network. Switch networks and try again.',
      exception: err
    });

  if (err instanceof Error && sdkErrorCopy) {
    const match = Object.entries(sdkErrorCopy).find(([sdkMessage]) => err.message.includes(sdkMessage));
    if (match) return new AppError({ message: match[1], exception: err });
  }

  return err;
}
