'use client';

import { ABI } from '@centrifuge/sdk';
import { encodeFunctionData } from 'viem';

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
    // Fail early when Returned Shares are already visible. The exact-call gate
    // below closes the remaining race if the SDK's later read sees a different
    // bucket while it builds the aggregate claim.
    action: async (_, { vault, address }) => {
      const investment = await readInvestment({ vault, investor: address });
      if (investment.claimableCancelRedeemShares > 0n)
        throw new AppError({ message: 'Claim your returned zMCA first.', capture: false });

      return { tx: vault.claim() };
    },

    expectedCall: (_, { address }) => ({
      to: CENTRIFUGE_CONFIG.vaultRouterAddress,
      data: encodeFunctionData({
        abi: ABI.VaultRouter,
        functionName: 'claimRedeem',
        args: [CENTRIFUGE_CONFIG.vaultAddress, address, address]
      }),
      mismatchMessage: 'Claimable balances changed. Claim your returned zMCA first.'
    }),

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
      if (!decoded)
        return {
          type: 'ERROR',
          title: 'Claim Could Not Be Verified',
          description: 'The transaction was confirmed, but the USDC claim could not be verified. Refresh your balances.',
          hash: receipt.transactionHash
        };

      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: 'USDC claimed',
        description: 'USDC has been transferred to your wallet.',
        hash: receipt.transactionHash,
        meta: { claimRedeem: { assets: decoded.assets, shares: decoded.shares } }
      };

      return transactionData;
    },

    onSuccessClose,

    invalidate: invalidateInvestmentQueries
  });
}
