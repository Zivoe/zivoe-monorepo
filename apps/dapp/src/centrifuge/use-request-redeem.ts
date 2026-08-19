'use client';

import { Balance } from '@centrifuge/sdk';

import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { type TransactionIdentity } from './types';
import useCentrifugeTx from './useCentrifugeTx';

/** All redemption-request copy that names tokens, generated over the share/asset symbol pair. */
function requestRedeemCopy({ asset, share }: { asset: string; share: string }) {
  return {
    simulationErrors: {
      InsufficientBalance: "You don't have enough shares for this redemption request.",
      CancellationIsPending: 'Wait for your cancellation to complete before requesting another redemption.',
      ZeroAmountNotAllowed: 'Enter an amount greater than zero.',
      VaultNotLinked: 'Redemption requests are temporarily unavailable. Try again later.',
      TransferNotAllowed: "This redemption request can't be submitted from this wallet right now.",
      TransferBlocked: "This redemption request can't be submitted from this wallet right now.",
      Paused: 'Redemptions are temporarily paused. Try again later.',
      NotEnoughGas: 'The network fee estimate changed. Try again.'
    },
    sdkErrors: {
      'Insufficient balance': "You don't have enough shares for this redemption request.",
      'Not allowed to redeem': "This redemption request can't be submitted from this wallet right now.",
      'Order amount must be greater than 0': 'Enter an amount greater than zero.',
      'Invalid amount decimals': `Enter a valid ${share} amount.`
    },
    pendingToast: 'Requesting Redemption...',
    errorToast: 'Error Requesting Redemption',
    success: {
      title: 'Redemption Requested',
      description: `Your final ${asset} amount is determined when your request is processed.`
    },
    failure: { title: 'Redemption Request Failed', description: 'Your redemption request could not be completed.' }
  };
}

type RequestRedeemVariables = {
  /** Exact shares to add to the Redemption Position, in share-token base units. */
  shares: bigint;
  /**
   * Indicative USDC at the current Share Price, in USDC base units. Optional:
   * the request settles at whatever price applies when it is processed, so a
   * Share Price we could not read holds nothing up — it only costs the
   * receipt its estimate.
   */
  estimatedAssets?: bigint;
};

export function useRequestRedeem({
  identity,
  onSuccessClose
}: {
  identity: TransactionIdentity;
  onSuccessClose?: () => void;
}) {
  const { shareClass } = identity;
  const usdc = shareClass.usdc;
  const copy = requestRedeemCopy({ asset: usdc.symbol, share: shareClass.symbol });

  return useCentrifugeTx<RequestRedeemVariables>({
    identity,

    // No position/Centrifuge-vault re-reads here: the SDK re-checks the share balance
    // itself ('Insufficient balance' maps below), and the exact-call simulation
    // is the authoritative pre-sign gate (CancellationIsPending and
    // VaultNotLinked surface as decoded copy).
    action: ({ shares }, { centrifugeVault }) => {
      if (shares <= 0n) throw new AppError({ message: 'No amount to redeem' });

      return { tx: centrifugeVault.asyncRedeem(new Balance(shares, shareClass.decimals)) };
    },

    simulationErrorCopy: copy.simulationErrors,
    sdkErrorCopy: copy.sdkErrors,

    analytics: {
      flow: 'redeem',
      input: ({ shares, estimatedAssets }, { address }) => ({
        walletAddress: address,
        chainId: shareClass.chainId,
        tokenIn: shareClass.symbol,
        tokenOut: usdc.symbol,
        amountInRaw: shares,
        amountOutRaw: estimatedAssets
      })
    },

    pendingToast: () => copy.pendingToast,
    errorToast: () => copy.errorToast,
    sentryFlow: 'redeem-request',

    transactionData: (receipt, { shares, estimatedAssets }) => {
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
          redeem: {
            share: { symbol: shareClass.symbol, decimals: shareClass.decimals },
            asset: { symbol: usdc.symbol, decimals: usdc.decimals },
            amount: shares,
            receive: estimatedAssets
          }
        }
      };

      return transactionData;
    },

    onSuccessClose
  });
}
