import * as Sentry from '@sentry/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, parseEventLogs } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { ocrCycleAbi } from '@zivoe/contracts/abis';

import { CONTRACTS, NETWORK } from '@/lib/constants';
import { queryKeys } from '@/lib/query-keys';
import { TransactionData, depositDialogAtom, transactionAtom } from '@/lib/store';
import { AppError, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import useTx from '@/hooks/useTx';

import { availableLiquidityQueryKey } from './useAvailableLiquidity';

export type RedeemUSDCParams = WriteContractParameters<typeof ocrCycleAbi, 'redeemUSDC'>;

export const useRedeemUSDC = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const mutationInfo = useMutation({
    mutationFn: async ({ amount }: { amount?: bigint }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to redeem' });

      const params: RedeemUSDCParams & SimulateContractParameters = {
        abi: ocrCycleAbi,
        address: CONTRACTS.OCR_Cycle,
        functionName: 'redeemUSDC',
        args: [amount]
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: 'Redeeming zVLT...' }
      });

      return { receipt, amount };
    },

    onError: (err, variables) => {
      onTxError({
        err,
        defaultToastMsg: 'Error Redeeming zVLT',
        sentry: { flow: 'redeem', extras: variables }
      });
    },

    onSuccess: ({ receipt, amount }) => {
      let depositAmount: bigint | undefined;
      let receiveAmount: bigint | undefined;

      try {
        const redeemLogs = parseEventLogs({
          abi: ocrCycleAbi,
          eventName: 'zVLTBurnedForUSDC',
          logs: receipt.logs
        });

        const redeemLog = redeemLogs[0];
        if (redeemLog) {
          depositAmount = redeemLog.args.zVLTBurned;
          receiveAmount = redeemLog.args.USDCRedeemed;

          // on sepolia the `USDC` token is a fake one that has 18 decimals
          // on mainnet we have the real USDC token which has 6 decimals
          if (NETWORK === 'SEPOLIA') receiveAmount = receiveAmount / 10n ** 12n;
        }
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'MUTATION', flow: 'redeem' } });
      }

      let meta: TransactionData['meta'] = undefined;
      if (amount && depositAmount && receiveAmount) {
        meta = {
          redeem: {
            amount: depositAmount,
            receive: receiveAmount
          }
        };
      }

      const transactionData: TransactionData =
        receipt.status === 'success'
          ? {
              type: 'SUCCESS',
              title: 'zVLT Redeemed',
              description: 'Your zVLT has been redeemed for USDC',
              hash: receipt.transactionHash,
              meta
            }
          : {
              type: 'ERROR',
              title: 'Redemption Failed',
              description: 'There was an error redeeming your zVLT',
              hash: receipt.transactionHash
            };

      setTransaction(transactionData);
      if (transactionData.type === 'SUCCESS') setIsDepositDialogOpen(false);
    },

    onSettled: (_, err) => {
      if (skipTxSettled(err)) return;

      // Refetch allowance for zVLT
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({
          accountAddress: address,
          contract: CONTRACTS.zVLT,
          spender: CONTRACTS.OCR_Cycle
        })
      });

      // Refetch zVLT balance
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.balanceOf({
          accountAddress: address,
          id: CONTRACTS.zVLT
        })
      });

      // Refetch balances
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.depositBalances({ accountAddress: address })
      });

      // Refetch available liquidity
      queryClient.invalidateQueries({
        queryKey: availableLiquidityQueryKey
      });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
