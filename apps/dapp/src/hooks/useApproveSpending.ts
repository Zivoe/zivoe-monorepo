import { type erc20Abi } from 'viem';
import { type Address } from 'viem/accounts';

import { type Token } from '@/types/constants';

import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import useTx, { parseReceiptEvent, type TxParams } from './useTx';

export type ApproveTokenAbi = typeof erc20Abi;
export type ApproveTokenParams = TxParams<ApproveTokenAbi, 'approve'>;

type ApproveSpendingVariables = {
  contract: Address;
  spender: Address;
  amount?: bigint;
  name: string;
  abi: ApproveTokenAbi;
  successMessage: string;
  errorMessage: string;
};

export const useApproveSpending = () => {
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
        tokenIn: name as Token,
        amountInRaw: amount,
        spender
      })
    },

    pendingToast: ({ name }) => `Approving ${name}...`,
    errorToast: ({ name }) => `Error Approving ${name}`,
    sentryFlow: 'approve',
    sentryExtras: ({ abi: _abi, ...variables }) => variables,

    transactionData: (receipt, { name, abi, successMessage, errorMessage }) => {
      let meta: TransactionData['meta'] = undefined;

      if (receipt.status === 'success') {
        const approvalLog = parseReceiptEvent({ receipt, abi, eventName: 'Approval', sentryFlow: 'approve' });
        const amount = approvalLog?.args.value;

        if (amount) {
          meta = {
            approve: {
              token: name as Token,
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
      // Refetch allowance
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
