import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { Abi, type SimulateContractParameters, erc20Abi, parseEventLogs } from 'viem';
import { type Address } from 'viem/accounts';
import { type WriteContractParameters } from 'wagmi/actions';

import { tetherTokenAbi, zivoeTrancheTokenAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { queryKeys } from '@/lib/query-keys';
import { TransactionData } from '@/lib/store';
import { transactionAtom } from '@/lib/store';
import { AppError, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from './useAccount';
import useTx from './useTx';

export type ApproveTokenAbi = typeof tetherTokenAbi | typeof zivoeTrancheTokenAbi | typeof erc20Abi;
export type ApproveTokenParams = WriteContractParameters<ApproveTokenAbi, 'approve'>;

export const useApproveSpending = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);

  const mutationInfo = useMutation({
    mutationFn: async ({
      contract,
      spender,
      amount,
      name,
      abi
    }: {
      contract: Address;
      spender: Address;
      amount?: bigint;
      name: string;
      abi: ApproveTokenAbi;
    }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to approve' });

      const params: ApproveTokenParams & SimulateContractParameters = {
        abi,
        address: contract,
        functionName: 'approve',
        args: [spender, amount]
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: `Approving ${name}...` }
      });

      return { receipt };
    },

    onError: (err, { name }) =>
      onTxError({
        err,
        defaultToastMsg: `Error Approving ${name}`
      }),

    onSuccess: ({ receipt }, { name, abi }) => {
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
                  token: name as DepositToken,
                  amount
                }
              };
            }
          }
        } catch (error) {
          console.error('Error parsing approval receipt', error);
        }
      }

      setTransaction(
        receipt.status === 'success'
          ? {
              type: 'SUCCESS',
              title: 'Approval Successful',
              description: `You can now deposit ${name}`,
              hash: receipt.transactionHash,
              meta
            }
          : {
              type: 'ERROR',
              title: 'Approval Failed',
              description: `There was an error approving ${name}`,
              hash: receipt.transactionHash
            }
      );
    },

    onSettled: (_, err, { contract, spender }) => {
      if (skipTxSettled(err)) return;

      // Refetch allowance
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({ accountAddress: address, contract, spender })
      });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
