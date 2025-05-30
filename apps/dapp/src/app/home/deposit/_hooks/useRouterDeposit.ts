import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type SimulateContractParameters } from 'viem';
import { useAccount } from 'wagmi';
import { type WriteContractParameters } from 'wagmi/actions';

import { zivoeRouterAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { AppError, onTxError, skipTxSettled } from '@/lib/utils';

import useTx from '@/hooks/useTx';

export type RouterDepositParams = WriteContractParameters<typeof zivoeRouterAbi, 'depositVault'>;

export const useRouterDeposit = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();

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
        messages: { pending: `Depositing ${stableCoinName}...`, success: `${stableCoinName} Deposited` }
      });

      return { receipt };
    },

    onError: (err, { stableCoinName }) =>
      onTxError({
        err,
        defaultToastMsg: `Error Depositing ${stableCoinName}`
      }),

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
