'use client';

import { Balance } from '@centrifuge/sdk';

import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_CONFIG } from './config';
import { decodeSyncDepositReceipt } from './decode';
import useCentrifugeTx, { invalidateInvestmentQueries } from './useCentrifugeTx';

const DEPOSIT_SIMULATION_ERROR_COPY = {
  InsufficientBalance: "You don't have enough USDC for this deposit.",
  InsufficientAllowance: 'Your USDC approval is no longer sufficient. Approve the amount again and retry.',
  ExceedsMaxDeposit: "This vault can't accept that deposit right now. Try a smaller amount or try again later.",
  InvalidPrice: 'The current deposit price is unavailable. Try again later.',
  RestrictionsFailed: "This deposit can't be completed for this wallet right now."
};

const DEPOSIT_SDK_ERROR_COPY = {
  'Insufficient balance': "You don't have enough USDC for this deposit.",
  'Not allowed to deposit': "This deposit can't be completed for this wallet right now.",
  'Order amount must be greater than 0': 'Enter an amount greater than zero.',
  'Invalid amount decimals': 'Enter a valid USDC amount.'
};

type DepositVariables = {
  /** Exact USDC amount in base units. */
  assets: bigint;
  /** The current successful preview for this exact amount (indicative zMCA). */
  previewShares: bigint;
};

export function useDeposit({ onSuccessClose }: { onSuccessClose?: () => void } = {}) {
  return useCentrifugeTx<DepositVariables>({
    // No balance/capacity re-reads here: the form guards against the cached
    // queries, and the exact-call simulation is the authoritative pre-sign gate
    // (it exercises the real revert paths and surfaces the decoded copy).
    action: async ({ assets, previewShares }, { vault }) => {
      if (assets <= 0n) throw new AppError({ message: 'No amount to deposit' });
      if (previewShares <= 0n) throw new AppError({ message: 'Missing deposit preview' });

      return { tx: vault.syncDeposit(new Balance(assets, CENTRIFUGE_CONFIG.usdc.decimals)) };
    },

    simulationErrorCopy: DEPOSIT_SIMULATION_ERROR_COPY,
    sdkErrorCopy: DEPOSIT_SDK_ERROR_COPY,

    analytics: {
      flow: 'deposit',
      input: ({ assets, previewShares }, { address }) => ({
        walletAddress: address,
        chainId: CENTRIFUGE_CONFIG.chainId,
        tokenIn: 'USDC',
        tokenOut: 'zMCA',
        amountInRaw: assets,
        amountOutRaw: previewShares
      }),
      receiptInput: (receipt) => {
        const decoded = decodeSyncDepositReceipt(receipt);
        return decoded ? { amountInRaw: decoded.assets, amountOutRaw: decoded.shares } : {};
      }
    },

    pendingToast: () => 'Depositing USDC...',
    errorToast: () => 'Error Depositing USDC',
    sentryFlow: 'deposit',

    transactionData: (receipt) => {
      if (receipt.status !== 'success')
        return {
          type: 'ERROR',
          title: 'Deposit Failed',
          description: 'Your deposit could not be completed.',
          hash: receipt.transactionHash
        };

      const decoded = decodeSyncDepositReceipt(receipt);
      const transactionData: TransactionData = {
        type: 'SUCCESS',
        title: 'Deposit Successful',
        description: 'zMCA has been transferred to your wallet.',
        hash: receipt.transactionHash,
        meta: decoded ? { deposit: { token: 'USDC', amount: decoded.assets, receive: decoded.shares } } : undefined
      };

      return transactionData;
    },

    onSuccessClose,

    invalidate: ({ queryClient, address }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({
          accountAddress: address,
          contract: CENTRIFUGE_CONFIG.usdc.address,
          spender: CENTRIFUGE_CONFIG.vaultRouterAddress
        })
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.app.vaultCapacity });
      invalidateInvestmentQueries({ queryClient, address });
    }
  });
}
