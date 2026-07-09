import { useSetAtom } from 'jotai';
import { type SimulateContractParameters } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { CONTRACTS } from '@zivoe/contracts';
import { ocrCycleV2Abi } from '@zivoe/contracts/abis';

import { queryKeys } from '@/lib/query-keys';
import { type TransactionData, depositDialogAtom } from '@/lib/store';
import { AppError } from '@/lib/utils';

import useTx, { parseReceiptEvent } from '@/hooks/useTx';

import { availableLiquidityQueryKey } from './useAvailableLiquidity';

export type RedeemUSDCParams = WriteContractParameters<typeof ocrCycleV2Abi, 'redeemUSDC'>;

type RedeemUSDCVariables = { amount?: bigint };

export const useRedeemUSDC = () => {
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  return useTx<RedeemUSDCVariables>({
    buildParams: ({ amount }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to redeem' });

      const params: RedeemUSDCParams & SimulateContractParameters = {
        abi: ocrCycleV2Abi,
        address: CONTRACTS.OCR_CycleV2,
        functionName: 'redeemUSDC',
        args: [amount]
      };

      return params;
    },

    analytics: {
      flow: 'redeem',
      input: ({ amount }, { address }) => ({
        walletAddress: address,
        tokenIn: 'zVLT',
        tokenOut: 'USDC',
        amountInRaw: amount
      })
    },

    pendingToast: () => 'Redeeming zVLT...',
    errorToast: () => 'Error Redeeming zVLT',
    sentryFlow: 'redeem',

    transactionData: (receipt, { amount }) => {
      const redeemLog = parseReceiptEvent({
        receipt,
        abi: ocrCycleV2Abi,
        eventName: 'zVLTBurnedForUSDC',
        sentryFlow: 'redeem'
      });

      const depositAmount = redeemLog?.args.zVLTBurned;
      const receiveAmount = redeemLog?.args.USDCRedeemed;

      let meta: TransactionData['meta'] = undefined;
      if (amount && depositAmount && receiveAmount) {
        meta = {
          redeem: {
            amount: depositAmount,
            receive: receiveAmount
          }
        };
      }

      return receipt.status === 'success'
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
    },

    onSuccessClose: () => setIsDepositDialogOpen(false),

    invalidate: ({ queryClient, address }) => {
      // Refetch allowance for zVLT
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({
          accountAddress: address,
          contract: CONTRACTS.zVLT,
          spender: CONTRACTS.OCR_CycleV2
        })
      });

      // Refetch zVLT balance
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.balanceOf({
          accountAddress: address,
          id: CONTRACTS.zVLT
        })
      });

      // Refetch balances
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.depositBalances({ accountAddress: address })
      });

      // Refetch available liquidity
      void queryClient.invalidateQueries({
        queryKey: availableLiquidityQueryKey
      });
    }
  });
};
