import { useSetAtom } from 'jotai';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeRewardsAbi } from '@zivoe/contracts/abis';

import { queryKeys } from '@/lib/query-keys';
import { type TransactionData, unstakeDialogAtom } from '@/lib/store';
import { AppError } from '@/lib/utils';

import useTx, { parseReceiptEvent, type TxParams } from '@/hooks/useTx';

export type UnstakeStSTTParams = TxParams<typeof zivoeRewardsAbi, 'withdraw'>;

type UnstakeStSTTVariables = { amount?: bigint };

export const useUnstakeStSTT = () => {
  const setIsUnstakeDialogOpen = useSetAtom(unstakeDialogAtom);

  return useTx<UnstakeStSTTVariables, UnstakeStSTTParams>({
    buildParams: ({ amount }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to unstake' });

      const params: UnstakeStSTTParams = {
        abi: zivoeRewardsAbi,
        address: CONTRACTS.stSTT,
        functionName: 'withdraw',
        args: [amount]
      };

      return params;
    },

    pendingToast: () => 'Unstaking stSTT...',
    errorToast: () => 'Error Unstaking stSTT',
    sentryFlow: 'unstake-ststt',

    transactionData: (receipt) => {
      const withdrawnLog = parseReceiptEvent({
        receipt,
        abi: zivoeRewardsAbi,
        eventName: 'Withdrawn',
        sentryFlow: 'unstake-ststt'
      });

      const amount = withdrawnLog?.args.amount;

      let meta: TransactionData['meta'] = undefined;
      if (amount) {
        meta = {
          unstake: { amount, receive: amount }
        };
      }

      return receipt.status === 'success'
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
    },

    onSuccessClose: () => setIsUnstakeDialogOpen(false),

    invalidate: ({ queryClient, address }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.balanceOf({
          accountAddress: address,
          id: CONTRACTS.stSTT
        })
      });

      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.depositBalances({ accountAddress: address })
      });
    }
  });
};
