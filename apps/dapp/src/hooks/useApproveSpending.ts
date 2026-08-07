import { type erc20Abi } from 'viem';
import { type Address } from 'viem/accounts';

import { NETWORK_CHAIN } from '@/lib/network';
import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import useTx, { type TxParams, parseReceiptEvent } from './useTx';

export type ApproveTokenAbi = typeof erc20Abi;
export type ApproveTokenParams = TxParams<ApproveTokenAbi, 'approve'>;

type ApproveSpendingVariables = {
  contract: Address;
  spender: Address;
  amount?: bigint;
  name: string;
  /** Snapshotted onto the payload so the receipt dialog renders the approved token exactly. */
  decimals: number;
  abi: ApproveTokenAbi;
  successMessage: string;
  errorMessage: string;
};

/**
 * The approval itself is deliberately cross-Offering (one router spender), but
 * the deposit funnel segments per product — the initiating Offering's slug is
 * hook-level identity so analytics AND Sentry captures carry it, same as
 * useCentrifugeTx tags every transaction of the flows behind it.
 */
export const useApproveSpending = ({ offeringSlug }: { offeringSlug: string }) => {
  return useTx<ApproveSpendingVariables, ApproveTokenParams>({
    buildParams: ({ contract, spender, amount, abi }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to approve' });

      const params: ApproveTokenParams = {
        abi,
        address: contract,
        functionName: 'approve',
        args: [spender, amount]
      };

      return params;
    },

    analytics: {
      flow: 'approval',
      input: ({ name, amount, spender }, { address }) => ({
        walletAddress: address,
        chainId: NETWORK_CHAIN.id,
        offeringSlug,
        tokenIn: name,
        amountInRaw: amount,
        spender
      })
    },

    pendingToast: ({ name }) => `Approving ${name}...`,
    errorToast: ({ name }) => `Error Approving ${name}`,
    sentryFlow: 'approve',
    sentryTags: { offering: offeringSlug },
    sentryExtras: ({ abi: _abi, ...variables }) => variables,

    transactionData: (receipt, { name, decimals, abi, successMessage, errorMessage }) => {
      let meta: TransactionData['meta'] = undefined;

      if (receipt.status === 'success') {
        const approvalLog = parseReceiptEvent({ receipt, abi, eventName: 'Approval', sentryFlow: 'approve' });
        const amount = approvalLog?.args.value;

        if (amount) {
          meta = {
            approve: {
              token: { symbol: name, decimals },
              amount
            }
          };
        }
      }

      return receipt.status === 'success'
        ? {
            type: 'SUCCESS',
            title: 'Approval Successful',
            description: successMessage,
            hash: receipt.transactionHash,
            meta
          }
        : {
            type: 'ERROR',
            title: 'Approval Failed',
            description: errorMessage,
            hash: receipt.transactionHash
          };
    },

    invalidate: ({ queryClient, address, vars }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({
          accountAddress: address,
          contract: vars.contract,
          spender: vars.spender
        })
      });
    }
  });
};
