'use client';

import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_CONFIG } from './config';
import useCentrifugeTx, { invalidateInvestmentQueries } from './useCentrifugeTx';

const CANCEL_REDEEM_SIMULATION_ERROR_COPY = {
  NoPendingRequest: 'There is no redemption request to cancel.',
  CancellationIsPending: 'Your cancellation is already being processed.',
  VaultNotLinked: 'Cancellations are temporarily unavailable for this vault.',
  TransferNotAllowed: "This cancellation can't be submitted from this wallet right now.",
  TransferBlocked: "This cancellation can't be submitted from this wallet right now.",
  Paused: 'Redemptions are temporarily paused. Try again later.',
  NotEnoughGas: 'The network fee estimate changed. Try again.'
};

const CANCEL_REDEEM_SDK_ERROR_COPY = {
  'No order to cancel': 'There is no redemption request to cancel.'
};

type CancelRedeemVariables = {
  /**
   * Pending zMCA at the moment of cancelling, in share-token base units. The
   * Cancellation always covers the full remaining pending amount, and the
   * CancelRedeemRequest event carries no amount — this snapshot is what the
   * dialog and analytics can show.
   */
  pendingShares: bigint;
};

export function useCancelRedeem({ onSuccessClose }: { onSuccessClose?: () => void } = {}) {
  return useCentrifugeTx<CancelRedeemVariables>({
    // No investment/vault re-reads here: the SDK re-checks the pending order
    // itself ('No order to cancel' maps below), and the exact-call simulation
    // is the authoritative pre-sign gate (CancellationIsPending surfaces as
    // decoded copy if a second cancel races in).
    action: ({ pendingShares }, { vault }) => {
      if (pendingShares <= 0n) throw new AppError({ message: 'No redemption request to cancel' });

      return { tx: vault.cancelRedeemRequest() };
    },

    simulationErrorCopy: CANCEL_REDEEM_SIMULATION_ERROR_COPY,
    sdkErrorCopy: CANCEL_REDEEM_SDK_ERROR_COPY,

    analytics: {
      flow: 'redeem_cancel',
      input: ({ pendingShares }, { address }) => ({
        walletAddress: address,
        chainId: CENTRIFUGE_CONFIG.chainId,
        tokenIn: 'zMCA',
        amountInRaw: pendingShares
      })
    },

    pendingToast: () => 'Cancelling redemption request...',
    errorToast: () => 'Error Cancelling Redemption',
    sentryFlow: 'redeem-cancel',

    transactionData: (receipt, { pendingShares }) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: 'Cancellation Failed',
          description: 'Your redemption request could not be cancelled.',
          hash: receipt.transactionHash
        };

      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: 'Cancellation requested',
        description:
          'Your zMCA will be available to claim once the cancellation is processed. Any portion already approved by the pool manager still executes and arrives as USDC.',
        hash: receipt.transactionHash,
        meta: { cancelRedeem: { shares: pendingShares } }
      };

      return transactionData;
    },

    onSuccessClose,

    invalidate: invalidateInvestmentQueries
  });
}
