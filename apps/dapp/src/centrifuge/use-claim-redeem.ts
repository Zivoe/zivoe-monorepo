'use client';

import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_CONFIG } from './config';
import { decodeClaimRedeemReceipt } from './decode';
import { readInvestment } from './reads';
import useCentrifugeTx, { invalidateInvestmentQueries } from './useCentrifugeTx';

const CLAIM_REDEEM_SIMULATION_ERROR_COPY = {
  VaultNotLinked: 'Claims are temporarily unavailable for this vault.',
  TransferNotAllowed: "These proceeds can't be claimed to this wallet right now.",
  TransferBlocked: "These proceeds can't be claimed to this wallet right now.",
  ExceedsRedeemLimits: 'Your claimable amount changed. Refresh and try again.',
  ExceedsMaxRedeem: 'Your claimable amount changed. Refresh and try again.',
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
    // The aggregate vault claim empties exactly ONE bucket per transaction, in
    // the SDK's fixed priority: Returned Shares before redemption USDC. Guard
    // on a fresh read (the same state the SDK builds calldata from) so a
    // cancellation fulfillment landing between the UI's last poll and the
    // click can't silently claim shares while this flow reports 'USDC
    // claimed'. Every other claimability check stays with the SDK ('No
    // claimable funds' maps below) and the exact-call simulation gate.
    action: async (_, { vault, address }) => {
      const investment = await readInvestment({ vault, investor: address });
      if (investment.claimableCancelRedeemShares > 0n)
        throw new AppError({ message: 'Claim your returned zMCA first.', capture: false });

      return { tx: vault.claim() };
    },

    simulationErrorCopy: CLAIM_REDEEM_SIMULATION_ERROR_COPY,
    sdkErrorCopy: CLAIM_REDEEM_SDK_ERROR_COPY,

    analytics: {
      flow: 'redeem_claim',
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
