import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, erc20Abi } from 'viem';
import { type Address } from 'viem/accounts';
import { useAccount } from 'wagmi';
import { type WriteContractParameters } from 'wagmi/actions';

import { queryKeys } from '@/lib/query-keys';
import { transactionAtom } from '@/lib/store';
import { AppError, onTxError, skipTxSettled } from '@/lib/utils';

import useTx from './useTx';

export type ApproveTokenParams = WriteContractParameters<typeof erc20Abi, 'approve'>;

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
      name
    }: {
      contract: Address;
      spender: Address;
      amount?: bigint;
      name: string;
    }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to approve' });

      const params: ApproveTokenParams & SimulateContractParameters = {
        abi: erc20Abi,
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

    onSuccess: ({ receipt }, { name }) => {
      setTransaction(
        receipt.status === 'success'
          ? {
              type: 'SUCCESS',
              title: `${name} Approved`,
              description: `You can now deposit ${name}`,
              hash: receipt.transactionHash
            }
          : {
              type: 'ERROR',
              title: `Error Approving ${name}`,
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
