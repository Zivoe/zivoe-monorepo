'use client';

import { useState } from 'react';

import * as Sentry from '@sentry/nextjs';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { toast as sonnerToast } from 'sonner';
import { type Address, type TransactionReceipt } from 'viem';
import { useConfig, usePublicClient } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';

import { toast } from '@zivoe/ui/core/sonner';

import {
  type TransactionAnalyticsInput,
  createTransactionProperties,
  getAnalyticsErrorType
} from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { queryKeys } from '@/lib/query-keys';
import { type TransactionData, transactionAtom } from '@/lib/store';
import { AppError, handlePromise, onTxError, skipTxSettled } from '@/lib/utils';

import { TX_ANALYTICS, type TxAnalyticsFlow, type TxAnalyticsInput, type TxAnalyticsStep } from '@/hooks/useTx';
import { useAccount } from '@/hooks/useAccount';

import { getVault, setTransactionSigner } from './client';
import { type TransactionEntity, type VaultEntity } from './entities';
import { type SimulationErrorCopy, createSimulationSigner } from './simulate';

type PublicClient = NonNullable<ReturnType<typeof usePublicClient>>;

type CentrifugeTxContext = { address: Address; vault: VaultEntity; publicClient: PublicClient };

export type CentrifugeTxConfig<TVariables> = {
  /**
   * Re-runs guards and starts the SDK action; throw AppError for validation
   * failures. Runs with the lazily resolved, simulation-wrapped signer already
   * installed on the SDK client. The transaction must be returned wrapped as
   * `{ tx }`: the SDK Transaction is also a PromiseLike, so returning it bare
   * through an await would execute it to completion with no subscriber.
   */
  action: (vars: TVariables, ctx: CentrifugeTxContext) => { tx: TransactionEntity } | Promise<{ tx: TransactionEntity }>;
  /** Decoded protocol error names mapped to flow-specific copy for the simulation block. */
  simulationErrorCopy: SimulationErrorCopy;
  /** SDK plain pre-signature error messages (matched by inclusion) mapped to product copy. */
  sdkErrorCopy?: Record<string, string>;
  analytics?: {
    flow: TxAnalyticsFlow;
    input: (vars: TVariables, ctx: { address: Address }) => TxAnalyticsInput;
    /** Exact receipt-decoded amounts for the confirmed step. */
    receiptInput?: (receipt: TransactionReceipt, vars: TVariables) => Partial<TransactionAnalyticsInput>;
  };
  pendingToast: (vars: TVariables) => string;
  errorToast: (vars: TVariables) => string;
  sentryFlow: string;
  sentryExtras?: (vars: TVariables) => Record<string, unknown>;
  transactionData: (receipt: TransactionReceipt, vars: TVariables) => TransactionData;
  onSuccessClose?: () => void;
  invalidate: (ctx: { queryClient: QueryClient; address: Address | undefined; vars: TVariables }) => void;
};

/**
 * Sibling of useTx for Centrifuge SDK actions: shares the guards -> simulate ->
 * send -> receipt toast -> transaction dialog -> refetches choreography, but
 * sends via the SDK action observed through its status Observable, with
 * simulate-before-sign enforced at the EIP-1193 signer boundary.
 */
export default function useCentrifugeTx<TVariables>(config: CentrifugeTxConfig<TVariables>) {
  const wagmiConfig = useConfig();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const setTransaction = useSetAtom(transactionAtom);

  const [isTxPending, setIsTxPending] = useState(false);

  const mutationInfo = useMutation({
    mutationFn: async (vars: TVariables) => {
      if (!address) throw new AppError({ message: 'Wallet not connected' });
      if (!publicClient) throw new Error('Public client not found');

      const choreography = config.analytics ? TX_ANALYTICS[config.analytics.flow] : undefined;
      const analyticsInput = config.analytics ? config.analytics.input(vars, { address }) : undefined;

      const capture = (entry: TxAnalyticsStep | undefined, extra?: Partial<TransactionAnalyticsInput>) => {
        if (!config.analytics || !entry || !analyticsInput) return;

        analytics.capture(
          entry.event,
          createTransactionProperties({
            flow: config.analytics.flow,
            step: entry.step,
            ...analyticsInput,
            ...extra
          })
        );
      };

      capture(choreography?.started);

      let txHash: string | undefined;
      let pendingToastId: string | number | undefined;
      let releaseSigner: (() => void) | undefined;

      try {
        const vault = await getVault();

        // Lazy signer resolution: the current wallet client is fetched per
        // transaction, so an account switch can never leave a stale signer.
        const { err: walletErr, res: walletClient } = await handlePromise(getWalletClient(wagmiConfig));
        if (walletErr || !walletClient) throw new AppError({ message: 'Wallet not connected', exception: walletErr });

        const signer = createSimulationSigner({
          walletClient,
          simulationClient: publicClient,
          errorCopy: config.simulationErrorCopy
        });
        releaseSigner = setTransactionSigner(signer);

        const { tx: transaction } = await config.action(vars, { address, vault, publicClient });

        const receipt = await new Promise<TransactionReceipt>((resolve, reject) => {
          let confirmed: TransactionReceipt | undefined;

          transaction.subscribe({
            next: (status) => {
              if (status.type === 'TransactionPending' && status.hash) {
                txHash = status.hash;
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
              // chain is the source of truth. Costs one read, only here.
              if (!txHash) {
                reject(err);
                return;
              }

              void handlePromise(publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })).then(
                ({ res }) => (res ? resolve(res) : reject(err))
              );
            },
            complete: () =>
              confirmed ? resolve(confirmed) : reject(new Error('Transaction stream completed without a receipt'))
          });
        });

        capture(receipt.status === 'success' ? choreography?.confirmed.success : choreography?.confirmed.failed, {
          txHash: receipt.transactionHash,
          receiptStatus: receipt.status,
          // Reverted receipts carry no transfer events — decoding them would
          // only fire a bogus failed-to-decode capture.
          ...(receipt.status === 'success' ? config.analytics?.receiptInput?.(receipt, vars) : undefined)
        });

        // A reverted receipt resolves into the failure dialog (the mutation
        // succeeds), so onError never sees it — capture here or the revert is
        // invisible to Sentry.
        if (receipt.status !== 'success')
          Sentry.captureException(new Error('Transaction reverted on-chain'), {
            tags: { source: 'MUTATION', flow: config.sentryFlow },
            extra: {
              ...(config.sentryExtras ? config.sentryExtras(vars) : toSentryExtras(vars)),
              txHash: receipt.transactionHash
            }
          });

        return { receipt };
      } catch (err) {
        const normalized = normalizeCentrifugeError(err, config.sdkErrorCopy);
        const errorType = getAnalyticsErrorType(normalized);

        capture(errorType === 'user_rejected' ? choreography?.rejected : choreography?.failed, {
          txHash,
          error_type: errorType
        });

        throw normalized;
      } finally {
        releaseSigner?.();
        setIsTxPending(false);
        if (pendingToastId !== undefined) sonnerToast.dismiss(pendingToastId);
      }
    },

    onError: (err, vars) => {
      onTxError({
        err,
        defaultToastMsg: config.errorToast(vars),
        sentry: {
          flow: config.sentryFlow,
          extras: config.sentryExtras ? config.sentryExtras(vars) : toSentryExtras(vars)
        }
      });
    },

    onSuccess: ({ receipt }, vars) => {
      const transactionData = config.transactionData(receipt, vars);

      setTransaction(transactionData);
      if (transactionData.type === 'SUCCESS') config.onSuccessClose?.();
    },

    onSettled: (_, err, vars) => {
      if (skipTxSettled(err)) return;
      config.invalidate({ queryClient, address, vars });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
}

/** The queries every confirmed Centrifuge transaction refreshes: zMCA/USDC balances, the investment, and the portfolio. */
export function invalidateInvestmentQueries({
  queryClient,
  address
}: {
  queryClient: QueryClient;
  address: Address | undefined;
}) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.account.balance({ accountAddress: address }) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.account.investment({ accountAddress: address }) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.account.portfolio({ accountAddress: address }) });
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
 * The SDK signs through a viem walletClient, whose transport wraps any error
 * thrown by our simulation signer (TransactionExecutionError → UnknownRpcError
 * → AppError), so the simulation's AppError surfaces on the cause chain, not
 * as the top-level error.
 */
function findAppError(err: unknown): AppError | undefined {
  for (let current = err, depth = 0; current instanceof Error && depth < 10; current = current.cause as Error, depth++) {
    if (current instanceof AppError) return current;
  }
  return undefined;
}

function normalizeCentrifugeError(err: unknown, sdkErrorCopy?: Record<string, string>): unknown {
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

function toSentryExtras(vars: unknown): Record<string, unknown> {
  if (vars && typeof vars === 'object') return vars as Record<string, unknown>;
  return {};
}
