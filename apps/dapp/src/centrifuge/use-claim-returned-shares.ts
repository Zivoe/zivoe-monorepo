'use client';

import { ABI } from '@centrifuge/sdk';
import { encodeFunctionData } from 'viem';

import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { decodeClaimReturnedSharesReceipt } from './decode';
import { readRedemptionPosition } from './reads';
import { type TransactionIdentity } from './types';
import useCentrifugeTx from './useCentrifugeTx';

/** All Returned Shares claim copy that names tokens, generated over the share symbol. */
function claimReturnedSharesCopy({ share }: { share: string }) {
  return {
    simulationErrors: {
      VaultNotLinked: 'Claims are temporarily unavailable. Try again later.',
      TransferNotAllowed: "These shares can't be claimed to this wallet right now.",
      TransferBlocked: "These shares can't be claimed to this wallet right now.",
      ShareTokenTransferFailed: `Returned ${share} is temporarily unavailable. Try again later.`,
      NotEnoughGas: 'The network fee estimate changed. Try again.'
    },
    sdkErrors: {
      'No claimable funds': `There is no returned ${share} available to claim yet.`
    },
    guard: `No returned ${share} to claim. Refresh and try again.`,
    mismatch: 'Claimable balances changed. Refresh and try again.',
    pendingToast: `Claiming ${share}...`,
    errorToast: `Error Claiming ${share}`,
    success: { title: `${share} Claimed`, description: `Your ${share} has been returned to your wallet.` },
    failure: { title: 'Claim Failed', description: `Your ${share} claim could not be completed.` },
    unverified: {
      title: 'Claim Could Not Be Verified',
      description: `The transaction was confirmed, but the ${share} claim could not be verified. Refresh your balances.`
    }
  };
}

type ClaimReturnedSharesVariables = {
  /** Currently claimable Returned Shares in base units — analytics snapshot; the claim itself is aggregate. */
  returnedShares: bigint;
};

/**
 * Claims Returned Shares via the same aggregate Centrifuge-vault claim as useClaimRedeem —
 * the SDK empties the Returned Shares bucket first, so only mount this behind
 * `claimableCancelRedeemShares > 0`.
 */
export function useClaimReturnedShares({
  identity,
  onSuccessClose
}: {
  identity: TransactionIdentity;
  onSuccessClose?: () => void;
}) {
  const { vaultRouterAddress, shareClass } = identity.centrifugeVault;
  const copy = claimReturnedSharesCopy({ share: shareClass.symbol });

  return useCentrifugeTx<ClaimReturnedSharesVariables>({
    identity,

    // Fail early when the Returned Shares bucket is already empty. The
    // exact-call gate below closes the remaining race if the SDK's later read
    // falls through to redemption USDC while building the aggregate claim.
    action: async (_, { centrifugeVault, address }) => {
      const position = await readRedemptionPosition({ centrifugeVault, investor: address });
      if (position.claimableCancelRedeemShares <= 0n) throw new AppError({ message: copy.guard, capture: false });

      return { tx: centrifugeVault.claim() };
    },

    expectedCall: (_, { address }) => ({
      to: vaultRouterAddress,
      data: encodeFunctionData({
        abi: ABI.VaultRouter,
        functionName: 'claimCancelRedeemRequest',
        args: [identity.centrifugeVault.address, address, address]
      }),
      mismatchMessage: copy.mismatch
    }),

    simulationErrorCopy: copy.simulationErrors,
    sdkErrorCopy: copy.sdkErrors,

    analytics: {
      flow: 'redeem_claim_returned',
      input: ({ returnedShares }, { address }) => ({
        walletAddress: address,
        chainId: identity.centrifugeVault.chainId,
        tokenOut: shareClass.symbol,
        amountOutRaw: returnedShares
      }),
      receiptInput: (receipt) => {
        const decoded = decodeClaimReturnedSharesReceipt({ receipt, identity });
        return decoded ? { amountOutRaw: decoded.shares } : {};
      }
    },

    pendingToast: () => copy.pendingToast,
    errorToast: () => copy.errorToast,
    sentryFlow: 'redeem-claim-returned',

    transactionData: (receipt) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: copy.failure.title,
          description: copy.failure.description,
          hash: receipt.transactionHash
        };

      const decoded = decodeClaimReturnedSharesReceipt({ receipt, identity });
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
          claimReturnedShares: {
            share: { symbol: shareClass.symbol, decimals: shareClass.decimals },
            shares: decoded.shares
          }
        }
      };

      return transactionData;
    },

    onSuccessClose
  });
}
