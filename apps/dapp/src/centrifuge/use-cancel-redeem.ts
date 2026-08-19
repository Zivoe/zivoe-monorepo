'use client';

import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { type TransactionIdentity } from './types';
import useCentrifugeTx from './useCentrifugeTx';

/** All cancellation copy that names tokens, generated over the share/asset symbol pair. */
function cancelRedeemCopy({ asset, share }: { asset: string; share: string }) {
  return {
    simulationErrors: {
      NoPendingRequest: 'There is no redemption request to cancel.',
      CancellationIsPending: 'Your cancellation is already being processed.',
      VaultNotLinked: 'Cancellations are temporarily unavailable. Try again later.',
      TransferNotAllowed: "This cancellation can't be submitted from this wallet right now.",
      TransferBlocked: "This cancellation can't be submitted from this wallet right now.",
      Paused: 'Redemptions are temporarily paused. Try again later.',
      NotEnoughGas: 'The network fee estimate changed. Try again.'
    },
    sdkErrors: {
      'No order to cancel': 'There is no redemption request to cancel.'
    },
    pendingToast: 'Cancelling Redemption Request...',
    errorToast: 'Error Cancelling Redemption',
    success: {
      title: 'Cancellation Requested',
      description: `Your ${share} will be available to claim once the cancellation is processed. Any portion already approved by the pool manager still executes and arrives as ${asset}.`
    },
    failure: { title: 'Cancellation Failed', description: 'Your redemption request could not be cancelled.' }
  };
}

type CancelRedeemVariables = {
  /**
   * Pending shares at the moment of cancelling, in share-token base units. The
   * Cancellation always covers the full remaining pending amount, and the
   * CancelRedeemRequest event carries no amount — this snapshot is what the
   * dialog and analytics can show.
   */
  pendingShares: bigint;
};

export function useCancelRedeem({
  identity,
  onSuccessClose
}: {
  identity: TransactionIdentity;
  onSuccessClose?: () => void;
}) {
  const { shareClass } = identity;
  const copy = cancelRedeemCopy({ asset: shareClass.usdc.symbol, share: shareClass.symbol });

  return useCentrifugeTx<CancelRedeemVariables>({
    identity,

    // No position/Centrifuge-vault re-reads here: the SDK re-checks the pending order
    // itself ('No order to cancel' maps below), and the exact-call simulation
    // is the authoritative pre-sign gate (CancellationIsPending surfaces as
    // decoded copy if a second cancel races in).
    action: ({ pendingShares }, { centrifugeVault }) => {
      if (pendingShares <= 0n) throw new AppError({ message: 'No redemption request to cancel' });

      return { tx: centrifugeVault.cancelRedeemRequest() };
    },

    simulationErrorCopy: copy.simulationErrors,
    sdkErrorCopy: copy.sdkErrors,

    analytics: {
      flow: 'redeem_cancel',
      input: ({ pendingShares }, { address }) => ({
        walletAddress: address,
        chainId: shareClass.chainId,
        tokenIn: shareClass.symbol,
        amountInRaw: pendingShares
      })
    },

    pendingToast: () => copy.pendingToast,
    errorToast: () => copy.errorToast,
    sentryFlow: 'redeem-cancel',

    transactionData: (receipt, { pendingShares }) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: copy.failure.title,
          description: copy.failure.description,
          hash: receipt.transactionHash
        };

      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: copy.success.title,
        description: copy.success.description,
        hash: receipt.transactionHash,
        meta: {
          cancelRedeem: {
            share: { symbol: shareClass.symbol, decimals: shareClass.decimals },
            shares: pendingShares
          }
        }
      };

      return transactionData;
    },

    onSuccessClose
  });
}
