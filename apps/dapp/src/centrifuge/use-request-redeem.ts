'use client';

import { Balance } from '@centrifuge/sdk';

import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_CONFIG } from './config';
import useCentrifugeTx, { invalidateInvestmentQueries } from './useCentrifugeTx';

const REQUEST_REDEEM_SIMULATION_ERROR_COPY = {
  InsufficientBalance: "You don't have enough shares for this redemption request.",
  CancellationIsPending: 'Wait for your cancellation to complete before requesting another redemption.',
  ZeroAmountNotAllowed: 'Enter an amount greater than zero.',
  VaultNotLinked: 'Redemption requests are temporarily unavailable for this vault.',
  TransferNotAllowed: "This redemption request can't be submitted from this wallet right now.",
  TransferBlocked: "This redemption request can't be submitted from this wallet right now.",
  Paused: 'Redemptions are temporarily paused. Try again later.',
  NotEnoughGas: 'The network fee estimate changed. Try again.'
};

const REQUEST_REDEEM_SDK_ERROR_COPY = {
  'Insufficient balance': "You don't have enough shares for this redemption request.",
  'Not allowed to redeem': "This redemption request can't be submitted from this wallet right now.",
  'Order amount must be greater than 0': 'Enter an amount greater than zero.',
  'Invalid amount decimals': 'Enter a valid zMCA amount.'
};

type RequestRedeemVariables = {
  /** Exact zMCA to add to the Redemption Position, in share-token base units. */
  shares: bigint;
  /** Indicative USDC at the current Share Price, in USDC base units. */
  estimatedAssets: bigint;
};

export function useRequestRedeem({ onSuccessClose }: { onSuccessClose?: () => void } = {}) {
  return useCentrifugeTx<RequestRedeemVariables>({
    // No investment/vault re-reads here: the SDK re-checks the share balance
    // itself ('Insufficient balance' maps below), and the exact-call simulation
    // is the authoritative pre-sign gate (CancellationIsPending and
    // VaultNotLinked surface as decoded copy).
    action: ({ shares }, { vault }) => {
      if (shares <= 0n) throw new AppError({ message: 'No amount to redeem' });

      return { tx: vault.asyncRedeem(new Balance(shares, CENTRIFUGE_CONFIG.shareToken.decimals)) };
    },

    simulationErrorCopy: REQUEST_REDEEM_SIMULATION_ERROR_COPY,
    sdkErrorCopy: REQUEST_REDEEM_SDK_ERROR_COPY,

    analytics: {
      flow: 'redeem',
      input: ({ shares, estimatedAssets }, { address }) => ({
        walletAddress: address,
        chainId: CENTRIFUGE_CONFIG.chainId,
        tokenIn: 'zMCA',
        tokenOut: 'USDC',
        amountInRaw: shares,
        amountOutRaw: estimatedAssets
      })
    },

    pendingToast: () => 'Requesting Redemption...',
    errorToast: () => 'Error Requesting Redemption',
    sentryFlow: 'redeem-request',

    transactionData: (receipt, { shares, estimatedAssets }) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: 'Redemption Request Failed',
          description: 'Your redemption request could not be completed.',
          hash: receipt.transactionHash
        };

      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: 'Redemption Requested',
        description: 'Your final USDC amount is determined when your request is processed.',
        hash: receipt.transactionHash,
        meta: { redeem: { amount: shares, receive: estimatedAssets } }
      };

      return transactionData;
    },

    onSuccessClose,

    invalidate: invalidateInvestmentQueries
  });
}
