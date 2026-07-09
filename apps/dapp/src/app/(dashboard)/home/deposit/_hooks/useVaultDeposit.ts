import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, parseEventLogs } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeRewardsAbi, zivoeVaultAbi } from '@zivoe/contracts/abis';

import { type DepositToken } from '@/types/constants';

import { depositDialogAtom } from '@/lib/store';
import { AppError, getDepositTransactionData, handleDepositRefetches } from '@/lib/utils';

import useTx from '@/hooks/useTx';

export type VaultDepositToken = Extract<DepositToken, 'zSTT'>;
export type VaultDepositParams = WriteContractParameters<typeof zivoeVaultAbi, 'deposit'>;

type VaultDepositVariables = { stableCoinName: VaultDepositToken; amount?: bigint };

export const useVaultDeposit = () => {
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  return useTx<VaultDepositVariables>({
    buildParams: ({ amount }, { address }) => {
      if (!address) throw new AppError({ message: 'Wallet not connected' });
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

      const params: VaultDepositParams & SimulateContractParameters = {
        abi: zivoeVaultAbi,
        address: CONTRACTS.zVLT,
        functionName: 'deposit',
        args: [amount, address]
      };

      return params;
    },

    analytics: {
      flow: 'deposit',
      input: ({ stableCoinName, amount }, { address }) => ({
        walletAddress: address,
        tokenIn: stableCoinName,
        tokenOut: 'zVLT',
        amountInRaw: amount
      })
    },

    pendingToast: ({ stableCoinName }) => `Depositing ${stableCoinName}...`,
    errorToast: ({ stableCoinName }) => `Error Depositing ${stableCoinName}`,
    sentryFlow: 'vault-deposit',

    transactionData: (receipt, { stableCoinName }) =>
      getDepositTransactionData({
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
      }),

    onSuccessClose: () => setIsDepositDialogOpen(false),

    invalidate: ({ queryClient, address, vars }) =>
      handleDepositRefetches({
        queryClient,
        address,
        stableCoinName: vars.stableCoinName,
        allowanceSpender: CONTRACTS.zVLT
      })
  });
};
