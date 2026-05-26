import * as Sentry from '@sentry/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, type erc20Abi, parseEventLogs } from 'viem';
import { type Address } from 'viem/accounts';
import { type WriteContractParameters } from 'wagmi/actions';

import { type tetherTokenAbi, type zivoeTrancheTokenAbi } from '@zivoe/contracts/abis';

import { type Token } from '@/types/constants';

import { createTransactionProperties, getAnalyticsErrorType } from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';
import { transactionAtom } from '@/lib/store';
import { AppError, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from './useAccount';
import useTx from './useTx';

export type ApproveTokenAbi = typeof tetherTokenAbi | typeof zivoeTrancheTokenAbi | typeof erc20Abi;
export type ApproveTokenParams = WriteContractParameters<ApproveTokenAbi, 'approve'>;

export const useApproveSpending = () => {
  const { address } = useAccount();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);

  const mutationInfo = useMutation({
    mutationFn: async ({
      contract,
      spender,
      amount,
      name,
      abi,
      successMessage,
      errorMessage
    }: {
      contract: Address;
      spender: Address;
      amount?: bigint;
      name: string;
      abi: ApproveTokenAbi;
      successMessage: string;
      errorMessage: string;
    }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to approve' });

      const baseAnalyticsInput = {
        flow: 'approval',
        step: 'started',
        walletAddress: address,
        tokenIn: name as Token,
        amountInRaw: amount,
        spender
      } as const;

      analytics.capture('tx:approval_started', createTransactionProperties(baseAnalyticsInput));

      const params: ApproveTokenParams & SimulateContractParameters = {
        abi,
        address: contract,
        functionName: 'approve',
        args: [spender, amount]
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);
      analytics.capture(
        'tx:approval_submitted',
        createTransactionProperties({
          ...baseAnalyticsInput,
          flow: 'approval',
          step: 'submitted',
          txHash: hash
        })
      );

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: `Approving ${name}...` }
      });

      analytics.capture(
        receipt.status === 'success' ? 'tx:approval_confirmed' : 'tx:approval_failed',
        createTransactionProperties({
          ...baseAnalyticsInput,
          flow: 'approval',
          step: receipt.status === 'success' ? 'confirmed' : 'failed',
          txHash: receipt.transactionHash,
          receiptStatus: receipt.status
        })
      );

      return { receipt, successMessage, errorMessage };
    },

    onError: (err, { abi: _abi, ...variables }) => {
      const errorType = getAnalyticsErrorType(err);

      analytics.capture(
        errorType === 'user_rejected' ? 'tx:approval_signature_rejected' : 'tx:approval_failed',
        createTransactionProperties({
          flow: 'approval',
          step: errorType === 'user_rejected' ? 'signature_rejected' : 'failed',
          walletAddress: address,
          tokenIn: variables.name as Token,
          amountInRaw: variables.amount,
          spender: variables.spender,
          error_type: errorType
        })
      );

      onTxError({
        err,
        defaultToastMsg: `Error Approving ${variables.name}`,
        sentry: { flow: 'approve', extras: variables }
      });
    },

    onSuccess: ({ receipt }, { name, abi, successMessage, errorMessage }) => {
      let meta: TransactionData['meta'] = undefined;

      if (receipt.status === 'success') {
        try {
          const approvalLogs = parseEventLogs({
            abi,
            eventName: 'Approval',
            logs: receipt.logs
          });

          const approvalLog = approvalLogs[0];
          if (approvalLog) {
            const amount = approvalLog.args.value;

            if (amount) {
              meta = {
                approve: {
                  token: name as Token,
                  amount
                }
              };
            }
          }
        } catch (error) {
          Sentry.captureException(error, { tags: { source: 'MUTATION', flow: 'approve' } });
        }
      }

      setTransaction(
        receipt.status === 'success'
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
            }
      );
    },

    onSettled: (_, err, { contract, spender }) => {
      if (skipTxSettled(err)) return;

      // Refetch allowance
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({ accountAddress: address, contract, spender })
      });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
