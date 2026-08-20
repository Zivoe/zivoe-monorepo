'use client';

import { Balance } from '@centrifuge/sdk';

import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { decodeSyncDepositReceipt } from './decode';
import { type TransactionIdentity } from './types';
import useCentrifugeTx from './useCentrifugeTx';

/** All deposit copy that names tokens, generated over the share/asset symbol pair. */
function depositCopy({ asset, share }: { asset: string; share: string }) {
  return {
    simulationErrors: {
      InsufficientBalance: `You don't have enough ${asset} for this deposit.`,
      InsufficientAllowance: `Your ${asset} approval is no longer sufficient. Approve the amount again and retry.`,
      ExceedsMaxDeposit: "This deposit can't be accepted right now. Try a smaller amount or try again later.",
      ExceedsMaxMint: "This deposit can't be accepted right now. Try a smaller amount or try again later.",
      InvalidPrice: 'The current deposit price is unavailable. Try again later.',
      RestrictionsFailed: "This deposit can't be completed for this wallet right now.",
      TransferBlocked: "This deposit can't be completed for this wallet right now."
    },
    sdkErrors: {
      'Insufficient balance': `You don't have enough ${asset} for this deposit.`,
      'Not allowed to deposit': "This deposit can't be completed for this wallet right now.",
      'Order amount must be greater than 0': 'Enter an amount greater than zero.',
      'Invalid amount decimals': `Enter a valid ${asset} amount.`
    },
    pendingToast: `Depositing ${asset}...`,
    errorToast: `Error Depositing ${asset}`,
    success: { title: 'Deposit Successful', description: `${share} has been transferred to your wallet.` },
    failure: { title: 'Deposit Failed', description: 'Your deposit could not be completed.' }
  };
}

type DepositVariables = {
  /** Exact USDC amount in base units. */
  assets: bigint;
  /** The current successful preview for this exact amount (indicative shares). */
  previewShares: bigint;
};

export function useDeposit({
  identity,
  onSuccessClose
}: {
  identity: TransactionIdentity;
  onSuccessClose?: () => void;
}) {
  const { usdc, vaultRouterAddress, shareClass } = identity.centrifugeVault;
  const copy = depositCopy({ asset: usdc.symbol, share: shareClass.symbol });

  return useCentrifugeTx<DepositVariables>({
    identity,

    // No balance/capacity re-reads here: the form guards against the cached
    // queries, and the exact-call simulation is the authoritative pre-sign gate
    // (it exercises the real revert paths and surfaces the decoded copy).
    action: async ({ assets, previewShares }, { centrifugeVault }) => {
      if (assets <= 0n) throw new AppError({ message: 'No amount to deposit' });
      if (previewShares <= 0n) throw new AppError({ message: 'Missing deposit preview' });

      return { tx: centrifugeVault.syncDeposit(new Balance(assets, usdc.decimals)) };
    },

    simulationErrorCopy: copy.simulationErrors,
    sdkErrorCopy: copy.sdkErrors,

    analytics: {
      flow: 'deposit',
      input: ({ assets, previewShares }, { address }) => ({
        walletAddress: address,
        chainId: identity.centrifugeVault.chainId,
        tokenIn: usdc.symbol,
        tokenOut: shareClass.symbol,
        amountInRaw: assets,
        amountOutRaw: previewShares
      }),
      receiptInput: (receipt) => {
        const decoded = decodeSyncDepositReceipt({ receipt, identity });
        return decoded ? { amountInRaw: decoded.assets, amountOutRaw: decoded.shares } : {};
      }
    },

    pendingToast: () => copy.pendingToast,
    errorToast: () => copy.errorToast,
    sentryFlow: 'deposit',

    transactionData: (receipt) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: copy.failure.title,
          description: copy.failure.description,
          hash: receipt.transactionHash
        };

      const decoded = decodeSyncDepositReceipt({ receipt, identity });
      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: copy.success.title,
        description: copy.success.description,
        hash: receipt.transactionHash,
        meta: decoded
          ? {
              deposit: {
                asset: { symbol: usdc.symbol, decimals: usdc.decimals },
                share: { symbol: shareClass.symbol, decimals: shareClass.decimals },
                amount: decoded.assets,
                receive: decoded.shares
              }
            }
          : undefined
      };

      return transactionData;
    },

    onSuccessClose,

    invalidateExtra: ({ queryClient, address }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({
          accountAddress: address,
          chain: identity.centrifugeVault.chain,
          contract: usdc.address,
          spender: vaultRouterAddress
        })
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.app.centrifugeVaultCapacity({
          shareClassKey: shareClass.key,
          chain: identity.centrifugeVault.chain
        })
      });
    }
  });
}
