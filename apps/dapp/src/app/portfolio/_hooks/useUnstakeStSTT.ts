import * as Sentry from '@sentry/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, parseEventLogs } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { zivoeRewardsAbi } from '@zivoe/contracts/abis';

import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { TransactionData, transactionAtom, unstakeDialogAtom } from '@/lib/store';
import { AppError, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import useTx from '@/hooks/useTx';

export type UnstakeStSTTParams = WriteContractParameters<typeof zivoeRewardsAbi, 'withdraw'>;

export const useUnstakeStSTT = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);
  const setIsUnstakeDialogOpen = useSetAtom(unstakeDialogAtom);

  const mutationInfo = useMutation({
    mutationFn: async ({ amount }: { amount?: bigint }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to unstake' });

      const params: UnstakeStSTTParams & SimulateContractParameters = {
        abi: zivoeRewardsAbi,
        address: CONTRACTS.stSTT,
        functionName: 'withdraw',
        args: [amount]
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: 'Unstaking stSTT...' }
      });

      return { receipt, amount };
    },

    onError: (err, variables) => {
      onTxError({
        err,
        defaultToastMsg: 'Error Unstaking stSTT',
        sentry: { flow: 'unstake-ststt', extras: variables }
      });
    },

    onSuccess: ({ receipt }) => {
      let amount: bigint | undefined;

      try {
        const withdrawnLogs = parseEventLogs({
          abi: zivoeRewardsAbi,
          eventName: 'Withdrawn',
          logs: receipt.logs
        });

        const withdrawnLog = withdrawnLogs[0];
        if (withdrawnLog) amount = withdrawnLog.args.amount;
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'MUTATION', flow: 'unstake-ststt' } });
      }

      let meta: TransactionData['meta'] = undefined;
      if (amount) {
        meta = {
          unstake: { amount, receive: amount }
        };
      }

      const transactionData: TransactionData =
        receipt.status === 'success'
          ? {
              type: 'SUCCESS',
              title: 'Unstake Successful',
              description: 'Your unstake has been completed.',
              hash: receipt.transactionHash,
              meta
            }
          : {
              type: 'ERROR',
              title: 'Unstake Failed',
              description: 'There was an error unstaking your stSTT',
              hash: receipt.transactionHash
            };

      setTransaction(transactionData);
      if (transactionData.type === 'SUCCESS') setIsUnstakeDialogOpen(false);
    },

    onSettled: (_, err) => {
      if (skipTxSettled(err)) return;

      // Refetch stSTT balance
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.balanceOf({
          accountAddress: address,
          id: CONTRACTS.stSTT
        })
      });

      // Refetch zSTT balance
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.depositBalances({ accountAddress: address })
      });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
