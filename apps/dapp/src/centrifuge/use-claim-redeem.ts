'use client';

import { ABI } from '@centrifuge/sdk';
import { encodeFunctionData } from 'viem';

import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_ENV } from './config';
import { decodeClaimRedeemReceipt } from './decode';
import { readRedemptionPosition } from './reads';
import { type TransactionIdentity } from './types';
import useCentrifugeTx from './useCentrifugeTx';

/** All claim copy that names tokens, generated over the share/asset symbol pair. */
function claimRedeemCopy({ asset, share }: { asset: string; share: string }) {
  return {
    simulationErrors: {
      VaultNotLinked: 'Claims are temporarily unavailable for this vault.',
      TransferNotAllowed: "These proceeds can't be claimed to this wallet right now.",
      TransferBlocked: "These proceeds can't be claimed to this wallet right now.",
      ExceedsRedeemLimits: 'Your claimable amount changed. Refresh and try again.',
      ExceedsMaxRedeem: 'Your claimable amount changed. Refresh and try again.',
      InsufficientReserve: 'Redemption proceeds are temporarily unavailable. Try again later.',
      InsufficientBalance: 'Redemption proceeds are temporarily unavailable. Try again later.'
    },
    sdkErrors: {
      'No claimable funds': 'There are no redemption proceeds available to claim yet.'
    },
    guard: `Claim your returned ${share} first.`,
    mismatch: `Claimable balances changed. Claim your returned ${share} first.`,
    pendingToast: `Claiming ${asset}...`,
    errorToast: `Error Claiming ${asset}`,
    success: { title: `${asset} Claimed`, description: `${asset} has been transferred to your wallet.` },
    failure: { title: 'Claim Failed', description: `Your ${asset} claim could not be completed.` },
    unverified: {
      title: 'Claim Could Not Be Verified',
      description: `The transaction was confirmed, but the ${asset} claim could not be verified. Refresh your balances.`
    }
  };
}

type ClaimRedeemVariables = {
  /** Currently claimable USDC in base units — analytics snapshot; the claim itself is aggregate. */
  claimableAssets: bigint;
};

export function useClaimRedeem({
  identity,
  onSuccessClose
}: {
  identity: TransactionIdentity;
  onSuccessClose?: () => void;
}) {
  const { shareClass } = identity;
  const usdc = CENTRIFUGE_ENV.usdc;
  const copy = claimRedeemCopy({ asset: usdc.symbol, share: shareClass.symbol });

  return useCentrifugeTx<ClaimRedeemVariables>({
    identity,

    // Fail early when Returned Shares are already visible. The exact-call gate
    // below closes the remaining race if the SDK's later read sees a different
    // bucket while it builds the aggregate claim.
    action: async (_, { vault, address }) => {
      const position = await readRedemptionPosition({ vault, investor: address });
      if (position.claimableCancelRedeemShares > 0n) throw new AppError({ message: copy.guard, capture: false });

      return { tx: vault.claim() };
    },

    expectedCall: (_, { address }) => ({
      to: CENTRIFUGE_ENV.vaultRouterAddress,
      data: encodeFunctionData({
        abi: ABI.VaultRouter,
        functionName: 'claimRedeem',
        args: [shareClass.vaultAddress, address, address]
      }),
      mismatchMessage: copy.mismatch
    }),

    simulationErrorCopy: copy.simulationErrors,
    sdkErrorCopy: copy.sdkErrors,

    analytics: {
      flow: 'redeem_claim',
      input: ({ claimableAssets }, { address }) => ({
        walletAddress: address,
        chainId: CENTRIFUGE_ENV.chainId,
        tokenIn: shareClass.symbol,
        tokenOut: usdc.symbol,
        amountOutRaw: claimableAssets
      }),
      receiptInput: (receipt) => {
        const decoded = decodeClaimRedeemReceipt({ receipt, vaultAddress: shareClass.vaultAddress, offeringSlug: identity.offeringSlug });
        return decoded ? { amountInRaw: decoded.shares, amountOutRaw: decoded.assets } : {};
      }
    },

    pendingToast: () => copy.pendingToast,
    errorToast: () => copy.errorToast,
    sentryFlow: 'redeem-claim',

    transactionData: (receipt) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: copy.failure.title,
          description: copy.failure.description,
          hash: receipt.transactionHash
        };

      const decoded = decodeClaimRedeemReceipt({ receipt, vaultAddress: shareClass.vaultAddress, offeringSlug: identity.offeringSlug });
      if (!decoded)
        return {
          type: 'ERROR',
          title: copy.unverified.title,
          description: copy.unverified.description,
          hash: receipt.transactionHash
        };

      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: copy.success.title,
        description: copy.success.description,
        hash: receipt.transactionHash,
        meta: {
          claimRedeem: {
            share: { symbol: shareClass.symbol, decimals: shareClass.decimals },
            asset: { symbol: usdc.symbol, decimals: usdc.decimals },
            assets: decoded.assets,
            shares: decoded.shares
          }
        }
      };

      return transactionData;
    },

    onSuccessClose
  });
}
