'use client';

import { type TransactionData } from '@/lib/store';

import { CENTRIFUGE_CONFIG } from './config';
import { decodeClaimReturnedSharesReceipt } from './decode';
import useCentrifugeTx, { invalidateInvestmentQueries } from './useCentrifugeTx';

const CLAIM_RETURNED_SHARES_SIMULATION_ERROR_COPY = {
  VaultNotLinked: 'Claims are temporarily unavailable for this vault.',
  TransferNotAllowed: "These shares can't be claimed to this wallet right now.",
  TransferBlocked: "These shares can't be claimed to this wallet right now.",
  ShareTokenTransferFailed: 'Returned zMCA is temporarily unavailable. Try again later.',
  NotEnoughGas: 'The network fee estimate changed. Try again.'
};

const CLAIM_RETURNED_SHARES_SDK_ERROR_COPY = {
  'No claimable funds': 'There is no returned zMCA available to claim yet.'
};

type ClaimReturnedSharesVariables = {
  /** Currently claimable Returned Shares in base units — analytics snapshot; the claim itself is aggregate. */
  returnedShares: bigint;
};

/**
 * Claims Returned Shares via the same aggregate vault claim as useClaimRedeem —
 * the SDK empties the Returned Shares bucket first, so only mount this behind
 * `claimableCancelRedeemShares > 0`.
 */
export function useClaimReturnedShares({ onSuccessClose }: { onSuccessClose?: () => void } = {}) {
  return useCentrifugeTx<ClaimReturnedSharesVariables>({
    // No investment/vault re-reads here: the SDK re-checks claimability itself
    // ('No claimable funds' maps below), and the exact-call simulation is the
    // authoritative pre-sign gate.
    action: (_, { vault }) => ({ tx: vault.claim() }),

    simulationErrorCopy: CLAIM_RETURNED_SHARES_SIMULATION_ERROR_COPY,
    sdkErrorCopy: CLAIM_RETURNED_SHARES_SDK_ERROR_COPY,

    analytics: {
      flow: 'redeem_claim_returned',
      input: ({ returnedShares }, { address }) => ({
        walletAddress: address,
        chainId: CENTRIFUGE_CONFIG.chainId,
        tokenOut: 'zMCA',
        amountOutRaw: returnedShares
      }),
      receiptInput: (receipt) => {
        const decoded = decodeClaimReturnedSharesReceipt(receipt);
        return decoded ? { amountOutRaw: decoded.shares } : {};
      }
    },

    pendingToast: () => 'Claiming zMCA...',
    errorToast: () => 'Error Claiming zMCA',
    sentryFlow: 'redeem-claim-returned',

    transactionData: (receipt) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: 'Claim Failed',
          description: 'Your zMCA claim could not be completed.',
          hash: receipt.transactionHash
        };

      const decoded = decodeClaimReturnedSharesReceipt(receipt);
      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: 'zMCA claimed',
        description: 'Your zMCA has been returned to your wallet.',
        hash: receipt.transactionHash,
        meta: decoded ? { claimReturnedShares: { shares: decoded.shares } } : undefined
      };

      return transactionData;
    },

    onSuccessClose,

    invalidate: invalidateInvestmentQueries
  });
}
