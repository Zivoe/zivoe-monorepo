import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters } from 'viem';
import { useAccount } from 'wagmi';
import { type WriteContractParameters } from 'wagmi/actions';

import { zivoeRouterAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { transactionAtom } from '@/lib/store';
import { AppError, onTxError, skipTxSettled } from '@/lib/utils';

import useTx from '@/hooks/useTx';

export type RouterDepositParams = WriteContractParameters<typeof zivoeRouterAbi, 'depositVault'>;

export const useRouterDeposit = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);

  const mutationInfo = useMutation({
    mutationFn: async ({ stableCoinName, amount }: { stableCoinName: DepositToken; amount?: bigint }) => {
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
      setTransaction(
        receipt.status === 'success'
          ? {
              type: 'SUCCESS',
              title: `Deposit Successful`,
              description: 'Your deposit has been completed.',
              hash: receipt.transactionHash,
              meta: {
                deposit: {
                  token: stableCoinName,
                  // TODO: parse receipt logs for actual transaction amounts
                  amount: 10n,
                  receive: 10n
                }
              }
            }
          : {
              type: 'ERROR',
              title: `Error Depositing ${stableCoinName}`,
              description: `There was an error depositing ${stableCoinName}`,
              hash: receipt.transactionHash
            }
      );
    },

    onSettled: (_, err, { stableCoinName }) => {
      if (skipTxSettled(err)) return;

      // Refetch allowance
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({
          accountAddress: address,
          contract: CONTRACTS[stableCoinName],
          spender: CONTRACTS.zRTR
        })
      });

      // Refetch deposit balances
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.depositBalances({ accountAddress: address })
      });

      // Refetch zVLT balance
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.balanceOf({ accountAddress: address, id: CONTRACTS.zVLT })
      });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
