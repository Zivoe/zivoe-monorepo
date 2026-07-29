'use client';

import { useState } from 'react';

import * as Sentry from '@sentry/nextjs';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type Address, type TransactionReceipt } from 'viem';

import {
  type AnalyticsEvent,
  type TransactionAnalyticsInput,
  createTransactionProperties,
  getAnalyticsErrorType
} from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { type TransactionData, transactionAtom } from '@/lib/store';
import { onTxError, skipTxSettled } from '@/lib/utils';

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

export type TxContext = { address: Address | undefined };

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

/**
 * Config every transaction driver shares. The lifecycle consumes all of it
 * except pendingToast, which drivers surface while acquiring the receipt.
 */
export type TxSharedConfig<TVariables> = {
  /** Analytics choreography for the transaction flow; omit for un-instrumented transactions. */
  analytics?: {
    flow: TxAnalyticsFlow;
    input: (vars: TVariables, ctx: TxContext) => TxAnalyticsInput;
    /** Exact receipt-decoded amounts for the confirmed step. */
    receiptInput?: (receipt: TransactionReceipt, vars: TVariables) => Partial<TransactionAnalyticsInput>;
  };
  pendingToast: (vars: TVariables) => string;
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

export type CaptureTxStep = (entry: TxAnalyticsStep | undefined, extra?: Partial<TransactionAnalyticsInput>) => void;

/** Lifecycle services a driver's send runs with. */
export type TxSendContext = {
  address: Address | undefined;
  choreography: TxAnalyticsChoreography | undefined;
  capture: CaptureTxStep;
  /**
   * Mirror every driver-side hash change here (including clearing it) so the
   * lifecycle's failure captures point at the driver's current transaction.
   */
  onTxHash: (hash: string | undefined) => void;
  setIsTxPending: (isPending: boolean) => void;
};

/**
 * The transaction lifecycle both drivers share: prepare -> started capture ->
 * send (driver-specific receipt acquisition) -> confirmed capture and
 * reverted-receipt Sentry -> transaction dialog -> query refetches. useTx
 * sends through viem simulate/write/wait; useCentrifugeTx through the SDK's
 * status Observable. A lifecycle change lands here once, for both drivers.
 */
export default function useTxLifecycle<TVariables, TPrepared>(
  config: TxSharedConfig<TVariables> & {
    /**
     * Pre-started phase: guards and call building. A throw here fires no
     * analytics capture at all, matching a validation failure.
     */
    prepare: (vars: TVariables, ctx: TxContext) => TPrepared | Promise<TPrepared>;
    /**
     * Acquires the receipt — everything between the started and confirmed
     * captures, including the driver's own cleanup. Runs inside the
     * lifecycle's try, so a throw lands in the shared rejected/failed
     * classification.
     */
    send: (vars: TVariables, prepared: TPrepared, ctx: TxSendContext) => Promise<TransactionReceipt>;
    /** Normalizes a thrown error before classification, capture, and the error toast. */
    normalizeError?: (err: unknown) => unknown;
  }
) {
  const { address } = useAccount();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const setTransaction = useSetAtom(transactionAtom);

  const [isTxPending, setIsTxPending] = useState(false);

  const mutationInfo = useMutation({
    mutationFn: async (vars: TVariables) => {
      const prepared = await config.prepare(vars, { address });

      const choreography = config.analytics ? TX_ANALYTICS[config.analytics.flow] : undefined;
      const analyticsInput = config.analytics ? config.analytics.input(vars, { address }) : undefined;

      const capture: CaptureTxStep = (entry, extra) => {
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

      try {
        const receipt = await config.send(vars, prepared, {
          address,
          choreography,
          capture,
          onTxHash: (hash) => (txHash = hash),
          setIsTxPending
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
        const normalized = config.normalizeError ? config.normalizeError(err) : err;
        const errorType = getAnalyticsErrorType(normalized);

        capture(errorType === 'user_rejected' ? choreography?.rejected : choreography?.failed, {
          txHash,
          error_type: errorType
        });

        throw normalized;
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

function toSentryExtras(vars: unknown): Record<string, unknown> {
  // Mutation variables are object literals (or undefined for void mutations).
  if (vars && typeof vars === 'object') return vars as Record<string, unknown>;
  return {};
}
