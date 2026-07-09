import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, parseEventLogs } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeRouterAbi, zivoeTranchesAbi } from '@zivoe/contracts/abis';

import { type DepositToken } from '@/types/constants';

import { depositDialogAtom } from '@/lib/store';
import { AppError, getDepositTransactionData, handleDepositRefetches } from '@/lib/utils';

import useTx from '@/hooks/useTx';

export type RouterDepositToken = Extract<DepositToken, 'USDT'>;
export type RouterDepositParams = WriteContractParameters<typeof zivoeRouterAbi, 'depositVault'>;

type RouterDepositVariables = { stableCoinName: RouterDepositToken; amount?: bigint };

export const useRouterDeposit = () => {
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  return useTx<RouterDepositVariables>({
    buildParams: ({ stableCoinName, amount }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

      const params: RouterDepositParams & SimulateContractParameters = {
        abi: zivoeRouterAbi,
        address: CONTRACTS.zRTR,
        functionName: 'depositVault',
        args: [CONTRACTS[stableCoinName], amount]
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
    sentryFlow: 'router-deposit',

    transactionData: (receipt, { stableCoinName }) =>
      getDepositTransactionData({
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
      }),

    onSuccessClose: () => setIsDepositDialogOpen(false),

    invalidate: ({ queryClient, address, vars }) =>
      handleDepositRefetches({
        queryClient,
        address,
        stableCoinName: vars.stableCoinName,
        allowanceSpender: CONTRACTS.zRTR
      })
  });
};
