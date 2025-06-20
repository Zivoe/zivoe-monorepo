import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { SimulateContractParameters, parseEventLogs } from 'viem';
import { useAccount } from 'wagmi';
import { WriteContractParameters } from 'wagmi/actions';

import { zivoeRewardsAbi, zivoeVaultAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { transactionAtom } from '@/lib/store';
import { AppError, getDepositTransactionData, handleDepositRefetches, onTxError, skipTxSettled } from '@/lib/utils';

import useTx from '@/hooks/useTx';

export type VaultDepositToken = Extract<DepositToken, 'zSTT'>;
export type VaultDepositParams = WriteContractParameters<typeof zivoeVaultAbi, 'deposit'>;

export const useVaultDeposit = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);

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
