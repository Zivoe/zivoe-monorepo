'use client';

import { type TransactionData } from '@/lib/store';

import { CENTRIFUGE_CONFIG } from './config';
import { decodeClaimRedeemReceipt } from './decode';
import useCentrifugeTx, { invalidateInvestmentQueries } from './useCentrifugeTx';

const CLAIM_REDEEM_SIMULATION_ERROR_COPY = {
  VaultNotLinked: 'Claims are temporarily unavailable for this vault.',
  TransferNotAllowed: "These proceeds can't be claimed to this wallet right now.",
  ExceedsRedeemLimits: 'Your claimable amount changed. Refresh and try again.',
  InsufficientReserve: 'Redemption proceeds are temporarily unavailable. Try again later.',
  InsufficientBalance: 'Redemption proceeds are temporarily unavailable. Try again later.'
};

const CLAIM_REDEEM_SDK_ERROR_COPY = {
  'No claimable funds': 'There are no redemption proceeds available to claim yet.'
};

type ClaimRedeemVariables = {
  /** Currently claimable USDC in base units — analytics snapshot; the claim itself is aggregate. */
  claimableAssets: bigint;
};

export function useClaimRedeem({ onSuccessClose }: { onSuccessClose?: () => void } = {}) {
  return useCentrifugeTx<ClaimRedeemVariables>({
    // No investment/vault re-reads here: the SDK re-checks claimability itself
    // ('No claimable funds' maps below), and the exact-call simulation is the
    // authoritative pre-sign gate (VaultNotLinked surfaces as decoded copy).
    action: (_, { vault }) => ({ tx: vault.claim() }),

    simulationErrorCopy: CLAIM_REDEEM_SIMULATION_ERROR_COPY,
    sdkErrorCopy: CLAIM_REDEEM_SDK_ERROR_COPY,

    analytics: {
      flow: 'redeem',
      input: ({ claimableAssets }, { address }) => ({
        walletAddress: address,
        chainId: CENTRIFUGE_CONFIG.chainId,
        tokenIn: 'zMCA',
        tokenOut: 'USDC',
        amountOutRaw: claimableAssets
      }),
      receiptInput: (receipt) => {
        const decoded = decodeClaimRedeemReceipt(receipt);
        return decoded ? { amountInRaw: decoded.shares, amountOutRaw: decoded.assets } : {};
      }
    },

    pendingToast: () => 'Claiming USDC...',
    errorToast: () => 'Error Claiming USDC',
    sentryFlow: 'redeem-claim',

    transactionData: (receipt) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: 'Claim Failed',
          description: 'Your USDC claim could not be completed.',
          hash: receipt.transactionHash
        };

      const decoded = decodeClaimRedeemReceipt(receipt);
      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: 'USDC claimed',
        description: 'USDC has been transferred to your wallet.',
        hash: receipt.transactionHash,
        meta: decoded ? { claimRedeem: { assets: decoded.assets, shares: decoded.shares } } : undefined
      };

      return transactionData;
    },

    onSuccessClose,

    invalidate: invalidateInvestmentQueries
  });
}
