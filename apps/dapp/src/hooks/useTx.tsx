'use client';

import { useState } from 'react';

import * as Sentry from '@sentry/nextjs';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { toast as sonnerToast } from 'sonner';
import {
  type Abi,
  BaseError,
  type ContractEventName,
  type ContractFunctionArgs,
  type ContractFunctionName,
  ContractFunctionRevertedError,
  type Hash,
  type SimulateContractParameters,
  type TransactionReceipt,
  parseEventLogs
} from 'viem';
import { type Address } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';
import { type WriteContractParameters } from 'wagmi/actions';

import { toast } from '@zivoe/ui/core/sonner';

import {
  type AnalyticsEvent,
  type TransactionAnalyticsInput,
  createTransactionProperties,
  getAnalyticsErrorType
} from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { type TransactionData, transactionAtom } from '@/lib/store';
import { AppError, handlePromise, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from './useAccount';

export type TxAnalyticsFlow =
  | 'deposit'
  | 'redeem'
  | 'redeem_claim'
  | 'redeem_cancel'
  | 'redeem_claim_returned'
  | 'approval';

export type TxAnalyticsInput = Omit<
  TransactionAnalyticsInput,
  'flow' | 'step' | 'txHash' | 'receiptStatus' | 'error_type'
>;

type TxContext = { address: Address | undefined };

/** Contract-call params that are both simulatable and writeable, so one build feeds simulate and send. */
export type TxParams<
  TAbi extends Abi = Abi,
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'> = ContractFunctionName<
    TAbi,
    'nonpayable' | 'payable'
  >
> = SimulateContractParameters<
  TAbi,
  TFunctionName,
  ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName>,
  undefined,
  undefined,
  Address | undefined
> &
  WriteContractParameters<TAbi, TFunctionName>;

export type TxConfig<TVariables, TParams extends TxParams> = {
  /** Builds (and guards) the contract call; throw AppError for validation failures. May be async (e.g. permit signing). */
  buildParams: (vars: TVariables, ctx: TxContext) => TParams | Promise<TParams>;
  /** Analytics choreography for the transaction flow; omit for un-instrumented transactions. */
  analytics?: {
    flow: TxAnalyticsFlow;
    input: (vars: TVariables, ctx: TxContext) => TxAnalyticsInput;
  };
  pendingToast: (vars: TVariables) => string;
  /** Extra wait after the receipt arrives, before the pending toast is dismissed. */
  receiptDelay?: number;
  errorToast: (vars: TVariables) => string;
  /** `flow` tag for the Sentry capture and toast handling on failure. */
  sentryFlow: string;
  /** Extras attached to the Sentry capture; defaults to the mutation variables. */
  sentryExtras?: (vars: TVariables) => Record<string, unknown>;
  /** Maps the confirmed receipt to the transaction dialog payload. */
  transactionData: (receipt: TransactionReceipt, vars: TVariables) => TransactionData;
  /** Runs when the transaction dialog payload is a SUCCESS (e.g. close the triggering dialog). */
  onSuccessClose?: () => void;
  /** Query invalidations after the transaction settles; skipped for no-refetch rejections. */
  invalidate: (ctx: { queryClient: QueryClient; address: Address | undefined; vars: TVariables }) => void;
};

export type TxAnalyticsStep = { event: AnalyticsEvent; step: string };

export type TxAnalyticsChoreography = {
  /** Captured after guards pass, before simulation (approval flow only). */
  started?: TxAnalyticsStep;
  submitted: TxAnalyticsStep;
  confirmed: { success: TxAnalyticsStep; failed: TxAnalyticsStep };
  rejected: TxAnalyticsStep;
  failed: TxAnalyticsStep;
};

export const TX_ANALYTICS: Record<TxAnalyticsFlow, TxAnalyticsChoreography> = {
  deposit: {
    submitted: { event: 'tx:deposit_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:deposit_receipt', step: 'receipt' },
      failed: { event: 'tx:deposit_failed', step: 'failed' }
    },
    rejected: { event: 'tx:deposit_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:deposit_failed', step: 'failed' }
  },
  redeem: {
    submitted: { event: 'tx:redeem_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:redeem_receipt', step: 'receipt' },
      failed: { event: 'tx:redeem_failed', step: 'failed' }
    },
    rejected: { event: 'tx:redeem_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:redeem_failed', step: 'failed' }
  },
  redeem_claim: {
    submitted: { event: 'tx:redeem_claim_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:redeem_claim_receipt', step: 'receipt' },
      failed: { event: 'tx:redeem_claim_failed', step: 'failed' }
    },
    rejected: { event: 'tx:redeem_claim_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:redeem_claim_failed', step: 'failed' }
  },
  redeem_cancel: {
    submitted: { event: 'tx:redeem_cancel_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:redeem_cancel_receipt', step: 'receipt' },
      failed: { event: 'tx:redeem_cancel_failed', step: 'failed' }
    },
    rejected: { event: 'tx:redeem_cancel_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:redeem_cancel_failed', step: 'failed' }
  },
  redeem_claim_returned: {
    submitted: { event: 'tx:redeem_claim_returned_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:redeem_claim_returned_receipt', step: 'receipt' },
      failed: { event: 'tx:redeem_claim_returned_failed', step: 'failed' }
    },
    rejected: { event: 'tx:redeem_claim_returned_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:redeem_claim_returned_failed', step: 'failed' }
  },
  approval: {
    started: { event: 'tx:approval_started', step: 'started' },
    submitted: { event: 'tx:approval_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:approval_confirmed', step: 'confirmed' },
      failed: { event: 'tx:approval_failed', step: 'failed' }
    },
    rejected: { event: 'tx:approval_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:approval_failed', step: 'failed' }
  }
};

function toSentryExtras(vars: unknown): Record<string, unknown> {
  // Mutation variables are object literals (or undefined for void mutations).
  if (vars && typeof vars === 'object') return vars as Record<string, unknown>;
  return {};
}

/**
 * Parses the first matching event log from a receipt, capturing (not throwing)
 * parse failures so the transaction dialog still renders.
 */
export function parseReceiptEvent<TAbi extends Abi, TEventName extends ContractEventName<TAbi>>({
  receipt,
  abi,
  eventName,
  sentryFlow
}: {
  receipt: TransactionReceipt;
  abi: TAbi;
  eventName: TEventName;
  sentryFlow: string;
}) {
  try {
    const logs = parseEventLogs({ abi, eventName, logs: receipt.logs });
    return logs[0];
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'MUTATION', flow: sentryFlow } });
    return undefined;
  }
}

/**
 * Drives one on-chain transaction through the shared lifecycle:
 * guards -> simulate -> send -> analytics -> pending toast until receipt ->
 * transaction dialog -> query refetches. Everything transaction-specific
 * comes in through the config.
 */
export default function useTx<TVariables, TParams extends TxParams>(config: TxConfig<TVariables, TParams>) {
  const publicClient = usePublicClient();
  const { mutateAsync: writeContract } = useWriteContract();
  const { address } = useAccount();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const setTransaction = useSetAtom(transactionAtom);

  const [isTxPending, setIsTxPending] = useState(false);

  const simulateTx = async (params: TParams) => {
    if (!publicClient) throw new Error('Public client not found');

    const { err } = await handlePromise(publicClient.simulateContract({ ...params, account: address }));
    if (!err) return;

    console.error('Simulation error: ', err);

    if (err instanceof BaseError) {
      const revertError = err.walk((err) => err instanceof ContractFunctionRevertedError);

      if (revertError instanceof ContractFunctionRevertedError) {
        const revertReason = revertError.reason;
        if (revertReason) throw new AppError({ message: `Simulation error: ${revertReason}`, exception: err });
      }
    }

    throw new AppError({ message: 'Simulation error', exception: err });
  };

  const sendTx = async (params: TParams) => {
    const { err, res: hash } = await handlePromise(writeContract(params));

    if (err || !hash) {
      const isUserRejection = err && err instanceof Error && err.message.includes('User rejected the request');
      if (isUserRejection)
        throw new AppError({
          message: 'Transaction rejected',
          exception: err,
          refetch: false,
          type: 'warning',
          capture: false
        });
      else throw err;
    }

    return hash;
  };

  const waitForTxReceipt = async ({ hash, pendingMessage }: { hash: Hash; pendingMessage: string }) => {
    if (!publicClient) throw new Error('Public client not found');

    setIsTxPending(true);
    const toastId = toast({ type: 'pending', title: pendingMessage });

    const { err, res: receipt } = await handlePromise(publicClient.waitForTransactionReceipt({ hash }));
    if (config.receiptDelay) await new Promise((resolve) => setTimeout(resolve, config.receiptDelay));

    setIsTxPending(false);
    sonnerToast.dismiss(toastId);

    if (err || !receipt) throw new AppError({ message: 'Error checking transaction receipt', exception: err });

    return receipt;
  };

  const mutationInfo = useMutation({
    mutationFn: async (vars: TVariables) => {
      const params = await config.buildParams(vars, { address });

      const choreography = config.analytics ? TX_ANALYTICS[config.analytics.flow] : undefined;
      const analyticsInput = config.analytics ? config.analytics.input(vars, { address }) : undefined;

      const capture = (
        entry: TxAnalyticsStep | undefined,
        extra?: Pick<TransactionAnalyticsInput, 'txHash' | 'receiptStatus' | 'error_type'>
      ) => {
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

      let txHash: Hash | undefined;

      try {
        await simulateTx(params);

        const hash = await sendTx(params);
        txHash = hash;
        capture(choreography?.submitted, { txHash });

        const receipt = await waitForTxReceipt({ hash, pendingMessage: config.pendingToast(vars) });

        capture(receipt.status === 'success' ? choreography?.confirmed.success : choreography?.confirmed.failed, {
          txHash: receipt.transactionHash,
          receiptStatus: receipt.status
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
        const errorType = getAnalyticsErrorType(err);

        capture(errorType === 'user_rejected' ? choreography?.rejected : choreography?.failed, {
          txHash,
          error_type: errorType
        });

        throw err;
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
