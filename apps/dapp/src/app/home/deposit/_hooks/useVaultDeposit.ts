import * as Sentry from '@sentry/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { SimulateContractParameters, parseEventLogs } from 'viem';
import { WriteContractParameters } from 'wagmi/actions';

import { zivoeRewardsAbi, zivoeVaultAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { depositDialogAtom, transactionAtom } from '@/lib/store';
import { AppError, getDepositTransactionData, handleDepositRefetches, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import useTx from '@/hooks/useTx';

export type VaultDepositToken = Extract<DepositToken, 'zSTT'>;
export type VaultDepositParams = WriteContractParameters<typeof zivoeVaultAbi, 'deposit'>;

export const useVaultDeposit = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const mutationInfo = useMutation({
    mutationFn: async ({ stableCoinName, amount }: { stableCoinName: VaultDepositToken; amount?: bigint }) => {
      if (!address) throw new AppError({ message: 'Wallet not connected' });
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

      const params: VaultDepositParams & SimulateContractParameters = {
        abi: zivoeVaultAbi,
        address: CONTRACTS.zVLT,
        functionName: 'deposit',
        args: [amount, address]
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: `Depositing ${stableCoinName}...` }
      });

      return { receipt };
    },

    onError: (err, variables) => {
      onTxError({
        err,
        defaultToastMsg: `Error Depositing ${variables.stableCoinName}`,
        sentry: { flow: 'vault-deposit', extras: variables }
      });
    },

    onSuccess: ({ receipt }, { stableCoinName }) => {
      const transactionData = getDepositTransactionData({
        stableCoinName,
        receipt,
        getDepositAmount: () => {
          let depositAmount: bigint | undefined;

          const rewardsStakedLogs = parseEventLogs({
            abi: zivoeRewardsAbi,
            eventName: 'Staked',
            logs: receipt.logs
          });

          const rewardsStakedLog = rewardsStakedLogs[0];
          if (rewardsStakedLog) depositAmount = rewardsStakedLog.args.amount;

          return depositAmount;
        }
      });

      setTransaction(transactionData);
      if (transactionData.type === 'SUCCESS') setIsDepositDialogOpen(false);
    },

    onSettled: (_, err, { stableCoinName }) => {
      if (skipTxSettled(err)) return;
      handleDepositRefetches({ queryClient, address, stableCoinName, allowanceSpender: CONTRACTS.zVLT });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
