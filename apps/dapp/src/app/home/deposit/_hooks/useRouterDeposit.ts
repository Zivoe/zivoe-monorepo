import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, parseEventLogs } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { zivoeRouterAbi, zivoeTranchesAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { depositDialogAtom, transactionAtom } from '@/lib/store';
import { AppError, getDepositTransactionData, handleDepositRefetches, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import useTx from '@/hooks/useTx';

export type RouterDepositToken = Extract<DepositToken, 'USDT'>;
export type RouterDepositParams = WriteContractParameters<typeof zivoeRouterAbi, 'depositVault'>;

export const useRouterDeposit = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const mutationInfo = useMutation({
    mutationFn: async ({ stableCoinName, amount }: { stableCoinName: RouterDepositToken; amount?: bigint }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

      const params: RouterDepositParams & SimulateContractParameters = {
        abi: zivoeRouterAbi,
        address: CONTRACTS.zRTR,
        functionName: 'depositVault',
        args: [CONTRACTS[stableCoinName], amount]
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: `Depositing ${stableCoinName}...` }
      });

      return { receipt };
    },

    onError: (err, { stableCoinName }) =>
      onTxError({
        err,
        defaultToastMsg: `Error Depositing ${stableCoinName}`
      }),

    onSuccess: ({ receipt }, { stableCoinName }) => {
      const transactionData = getDepositTransactionData({
        stableCoinName,
        receipt,
        getDepositAmount: () => {
          let depositAmount: bigint | undefined;

          const seniorDepositLogs = parseEventLogs({
            abi: zivoeTranchesAbi,
            eventName: 'SeniorDeposit',
            logs: receipt.logs
          });

          const seniorDepositLog = seniorDepositLogs[0];
          if (seniorDepositLog) depositAmount = seniorDepositLog.args.amount;

          return depositAmount;
        }
      });

      setTransaction(transactionData);
      if (transactionData.type === 'SUCCESS') setIsDepositDialogOpen(false);
    },

    onSettled: (_, err, { stableCoinName }) => {
      if (skipTxSettled(err)) return;
      handleDepositRefetches({ queryClient, address, stableCoinName, allowanceSpender: CONTRACTS.zRTR });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
