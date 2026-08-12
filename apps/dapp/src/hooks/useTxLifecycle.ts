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
  /** Captured when the mutation begins, right after the prepare guards pass. */
  started?: TxAnalyticsStep;
  submitted: TxAnalyticsStep;
  confirmed: { success: TxAnalyticsStep; failed: TxAnalyticsStep };
  rejected: TxAnalyticsStep;
  failed: TxAnalyticsStep;
};

export const TX_ANALYTICS: Record<TxAnalyticsFlow, TxAnalyticsChoreography> = {
  deposit: {
    started: { event: 'tx:deposit_started', step: 'started' },
    submitted: { event: 'tx:deposit_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:deposit_receipt', step: 'receipt' },
      failed: { event: 'tx:deposit_failed', step: 'failed' }
    },
    rejected: { event: 'tx:deposit_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:deposit_failed', step: 'failed' }
  },
  redeem: {
    started: { event: 'tx:redeem_started', step: 'started' },
    submitted: { event: 'tx:redeem_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:redeem_receipt', step: 'receipt' },
      failed: { event: 'tx:redeem_failed', step: 'failed' }
    },
    rejected: { event: 'tx:redeem_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:redeem_failed', step: 'failed' }
  },
  redeem_claim: {
    started: { event: 'tx:redeem_claim_started', step: 'started' },
    submitted: { event: 'tx:redeem_claim_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:redeem_claim_receipt', step: 'receipt' },
      failed: { event: 'tx:redeem_claim_failed', step: 'failed' }
    },
    rejected: { event: 'tx:redeem_claim_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:redeem_claim_failed', step: 'failed' }
  },
  redeem_cancel: {
    started: { event: 'tx:redeem_cancel_started', step: 'started' },
    submitted: { event: 'tx:redeem_cancel_submitted', step: 'submitted' },
    confirmed: {
      success: { event: 'tx:redeem_cancel_receipt', step: 'receipt' },
      failed: { event: 'tx:redeem_cancel_failed', step: 'failed' }
    },
    rejected: { event: 'tx:redeem_cancel_signature_rejected', step: 'signature_rejected' },
    failed: { event: 'tx:redeem_cancel_failed', step: 'failed' }
  },
  redeem_claim_returned: {
    started: { event: 'tx:redeem_claim_returned_started', step: 'started' },
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
  /**
   * Indexed Sentry tags merged into every capture (extras render but cannot
   * be filtered or alerted on — identity worth triaging by belongs here).
   */
  sentryTags?: Record<string, string>;
  /** Extras attached to the Sentry capture; defaults to the mutation variables. */
  sentryExtras?: (vars: TVariables) => Record<string, unknown>;
  /**
   * Zivoe Vault the transaction runs against — stamped onto the dialog payload
   * (built and fallback alike) and derived into the `zivoeVault` Sentry tag and
   * `zivoeVaultSlug` extra, so every driver carries the same stable Zivoe Vault
   * identity without per-driver stamps.
   */
  zivoeVaultSlug?: string;
  /**
   * Maps the confirmed receipt to the transaction dialog payload. Runs inside
   * the mutation, so the payload snapshots the identity the hook was handed
   * when the transaction started — the mutation observer re-syncs its
   * callbacks to the latest render, and a payload built in onSuccess would
   * take whatever identity that render happens to hold.
   */
  transactionData: (receipt: TransactionReceipt, vars: TVariables) => TransactionData;
  /** Runs when the transaction dialog payload is a SUCCESS (e.g. close the triggering dialog). */
  onSuccessClose?: () => void;
  /**
   * Query invalidations after the transaction settles; skipped for no-refetch
   * rejections. Runs inside the mutation — pinned, like transactionData, to
   * the options the mutation started with, so a hook re-rendered under
   * another identity mid-flight can never refetch the wrong scope. Only what
   * runs inside the mutation is pinned: onError/errorToast/sentry* are
   * observer callbacks and read the latest render's options (cross-identity
   * re-renders are unreachable today — the route keys the subtree by slug).
   */
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

  // The extras default is resolved once here — capture sites below must not
  // each re-implement the fallback — and the Zivoe Vault identity is derived
  // into tags/extras from the one slug field instead of per-driver stamps.
  const resolvedExtras = config.sentryExtras ?? toSentryExtras;
  const sentryTags = config.zivoeVaultSlug
    ? { zivoeVault: config.zivoeVaultSlug, ...config.sentryTags }
    : config.sentryTags;
  const sentryExtras = (vars: TVariables) =>
    config.zivoeVaultSlug ? { ...resolvedExtras(vars), zivoeVaultSlug: config.zivoeVaultSlug } : resolvedExtras(vars);

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

      // One envelope for every mutation-scope capture: the same tags, the
      // resolved extras, and a `stage` tag so revert/payload/invalidate
      // failures stay distinguishable in Sentry triage.
      const captureMutationError = (error: unknown, { stage, txHash }: { stage: string; txHash?: string }) =>
        Sentry.captureException(error, {
          tags: { source: 'MUTATION', flow: config.sentryFlow, stage, ...sentryTags },
          extra: { ...sentryExtras(vars), ...(txHash ? { txHash } : {}) }
        });

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
          captureMutationError(new Error('Transaction reverted on-chain'), {
            stage: 'revert',
            txHash: receipt.transactionHash
          });

        // A throw while building the payload must not fall into the catch
        // below — it would classify a settled transaction as failed, and a
        // confirmed on-chain transaction must never be displayed as failed.
        // Fall back to a minimal payload and capture the construction error.
        let transactionData: TransactionData;
        try {
          transactionData = config.transactionData(receipt, vars);
        } catch (payloadError) {
          captureMutationError(payloadError, { stage: 'payload', txHash: receipt.transactionHash });

          transactionData =
            receipt.status === 'success'
              ? {
                  type: 'SUCCESS',
                  title: 'Transaction Confirmed',
                  description: 'Your transaction has been confirmed on-chain.',
                  hash: receipt.transactionHash
                }
              : {
                  type: 'ERROR',
                  title: 'Transaction Failed',
                  description: 'Your transaction could not be completed.',
                  hash: receipt.transactionHash
                };
        }

        // Stamped after the fallback so every payload shape carries the slug.
        if (config.zivoeVaultSlug) transactionData = { ...transactionData, zivoeVaultSlug: config.zivoeVaultSlug };

        // Same rule as the payload above: a throw after the receipt must never
        // re-classify a settled transaction as failed — capture and move on.
        // This guards synchronous throws (key construction and the like); the
        // invalidations themselves are fire-and-forget voided promises whose
        // rejections TanStack surfaces through the query cache, not here.
        try {
          config.invalidate({ queryClient, address, vars });
        } catch (invalidateError) {
          captureMutationError(invalidateError, { stage: 'invalidate', txHash: receipt.transactionHash });
        }

        return { receipt, transactionData };
      } catch (err) {
        const normalized = config.normalizeError ? config.normalizeError(err) : err;
        const errorType = getAnalyticsErrorType(normalized);

        capture(errorType === 'user_rejected' ? choreography?.rejected : choreography?.failed, {
          txHash,
          error_type: errorType
        });

        // Settled non-rejection failures still refetch — the chain may have
        // moved (e.g. a late broadcast) even though this mutation failed. A
        // throwing invalidation must not displace the real error below.
        if (!skipTxSettled(normalized)) {
          try {
            config.invalidate({ queryClient, address, vars });
          } catch (invalidateError) {
            captureMutationError(invalidateError, { stage: 'invalidate', txHash });
          }
        }

        throw normalized;
      }
    },

    onError: (err, vars) => {
      onTxError({
        err,
        defaultToastMsg: config.errorToast(vars),
        sentry: {
          flow: config.sentryFlow,
          tags: sentryTags,
          extras: sentryExtras(vars)
        }
      });
    },

    onSuccess: ({ transactionData }) => {
      setTransaction(transactionData);
      if (transactionData.type === 'SUCCESS') config.onSuccessClose?.();
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
}

/** The default Sentry extras: the mutation variables themselves. Exported so drivers can extend it. */
export function toSentryExtras(vars: unknown): Record<string, unknown> {
  // Mutation variables are object literals (or undefined for void mutations).
  if (vars && typeof vars === 'object') return vars as Record<string, unknown>;
  return {};
}
