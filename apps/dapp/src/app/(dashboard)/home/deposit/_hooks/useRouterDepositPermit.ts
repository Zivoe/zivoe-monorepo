import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, hexToNumber, parseEventLogs, slice } from 'viem';
import { mainnet } from 'viem/chains';
import { usePublicClient, useWalletClient } from 'wagmi';
import { type WriteContractParameters } from 'wagmi/actions';

import { CONTRACTS } from '@zivoe/contracts';
import { erc20PermitAbi, zivoeRouterAbi, zivoeTranchesAbi } from '@zivoe/contracts/abis';

import { type DepositToken } from '@/types/constants';

import { createTransactionProperties, getAnalyticsErrorType } from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { depositDialogAtom, transactionAtom } from '@/lib/store';
import {
  AppError,
  getDepositTransactionData,
  handleDepositRefetches,
  handlePromise,
  onTxError,
  skipTxSettled
} from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import useTx from '@/hooks/useTx';

export type RouterDepositPermitToken = Extract<DepositToken, 'USDC' | 'frxUSD'>;
export type RouterDepositPermitParams = WriteContractParameters<typeof zivoeRouterAbi, 'depositWithPermit'>;

export const useRouterDepositPermit = () => {
  const publicClient = usePublicClient();
  const analytics = useAnalytics();
  const { data: walletClient } = useWalletClient({ query: { retry: 0, meta: { skipErrorToast: true } } });
  const queryClient = useQueryClient();
  const setTransaction = useSetAtom(transactionAtom);
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const { address } = useAccount();

  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const [isPermitPending, setIsPermitPending] = useState(false);

  const mutationInfo = useMutation({
    mutationFn: async ({ stableCoinName, amount }: { stableCoinName: RouterDepositPermitToken; amount?: bigint }) => {
      if (!walletClient || !publicClient || !address) throw new AppError({ message: 'Client or address not found' });
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

      const depositAnalyticsInput = {
        flow: 'deposit',
        step: 'submitted',
        walletAddress: address,
        tokenIn: stableCoinName,
        tokenOut: 'zVLT',
        amountInRaw: amount
      } as const;

      const permitAnalyticsInput = {
        flow: 'permit',
        step: 'started',
        walletAddress: address,
        tokenIn: stableCoinName,
        amountInRaw: amount,
        spender: CONTRACTS.zRTR
      } as const;

      setIsPermitPending(true);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 minutes from now

      let signature: `0x${string}` | undefined;

      try {
        analytics.capture('tx:permit_started', createTransactionProperties(permitAnalyticsInput));

        const nonce = await publicClient.readContract({
          address: CONTRACTS[stableCoinName],
          abi: erc20PermitAbi,
          functionName: 'nonces',
          args: [address]
        });

        const signResult = await handlePromise(
          walletClient.signTypedData({
            account: address,
            primaryType: 'Permit',
            types: TYPES,
            message: {
              owner: address,
              spender: CONTRACTS.zRTR,
              value: amount,
              nonce,
              deadline
            },
            domain: {
              ...DOMAIN[stableCoinName],
              verifyingContract: CONTRACTS[stableCoinName]
            }
          })
        );

        if (signResult.err || !signResult.res) {
          const isUserRejection =
            signResult.err &&
            signResult.err instanceof Error &&
            signResult.err.message.includes('User rejected the request');

          if (isUserRejection) {
            throw new AppError({
              message: 'Transaction rejected',
              exception: signResult.err,
              refetch: false,
              type: 'warning',
              capture: false
            });
          }

          throw signResult.err instanceof Error ? signResult.err : new AppError({ message: 'Error signing data' });
        }

        signature = signResult.res;
        analytics.capture('tx:permit_signed', createTransactionProperties({ ...permitAnalyticsInput, step: 'signed' }));
      } catch (err) {
        const errorType = getAnalyticsErrorType(err);

        analytics.capture(
          errorType === 'user_rejected' ? 'tx:permit_signature_rejected' : 'tx:permit_failed',
          createTransactionProperties({
            ...permitAnalyticsInput,
            step: errorType === 'user_rejected' ? 'signature_rejected' : 'failed',
            error_type: errorType
          })
        );

        throw err;
      } finally {
        setIsPermitPending(false);
      }

      if (!signature) throw new AppError({ message: 'Error signing data' });

      const v = hexToNumber(slice(signature, 64, 65));
      const r = slice(signature, 0, 32);
      const s = slice(signature, 32, 64);

      const params: RouterDepositPermitParams & SimulateContractParameters = {
        abi: zivoeRouterAbi,
        address: CONTRACTS.zRTR,
        functionName: 'depositWithPermit',
        args: [address, CONTRACTS[stableCoinName], amount, deadline, v, r, s]
      };

      let txHash: `0x${string}` | undefined;

      try {
        await simulateTx(params);

        const { hash } = await sendTx(params);
        txHash = hash;
        analytics.capture('tx:deposit_submitted', createTransactionProperties({ ...depositAnalyticsInput, txHash }));

        const receipt = await waitForTxReceipt({
          hash,
          messages: { pending: `Depositing ${stableCoinName}...` }
        });

        analytics.capture(
          receipt.status === 'success' ? 'tx:deposit_receipt' : 'tx:deposit_failed',
          createTransactionProperties({
            ...depositAnalyticsInput,
            step: receipt.status === 'success' ? 'receipt' : 'failed',
            txHash: receipt.transactionHash,
            receiptStatus: receipt.status
          })
        );

        return { receipt };
      } catch (err) {
        const errorType = getAnalyticsErrorType(err);

        analytics.capture(
          errorType === 'user_rejected' ? 'tx:deposit_signature_rejected' : 'tx:deposit_failed',
          createTransactionProperties({
            ...depositAnalyticsInput,
            step: errorType === 'user_rejected' ? 'signature_rejected' : 'failed',
            txHash,
            error_type: errorType
          })
        );

        throw err;
      }
    },

    onError: (err, variables) =>
      onTxError({
        err,
        defaultToastMsg: `Error Depositing ${variables.stableCoinName}`,
        sentry: { flow: 'router-deposit-permit', extras: variables }
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
      handleDepositRefetches({ queryClient, address, stableCoinName, allowanceSpender: undefined });
    }
  });

  return {
    isTxPending,
    isPermitPending,
    ...mutationInfo
  };
};

const DOMAIN: Record<RouterDepositPermitToken, { name: string; version: string; chainId: number }> = {
  USDC: {
    name: 'USD Coin',
    version: '2',
    chainId: mainnet.id
  },
  frxUSD: {
    name: 'Frax USD',
    version: '1',
    chainId: mainnet.id
  }
};

const TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
} as const;
