import { useState } from 'react';

import { useSetAtom } from 'jotai';
import { hexToNumber, slice } from 'viem';
import { mainnet } from 'viem/chains';
import { usePublicClient, useWalletClient } from 'wagmi';

import { CONTRACTS } from '@zivoe/contracts';
import { erc20PermitAbi, zivoeRouterAbi, zivoeTranchesAbi } from '@zivoe/contracts/abis';

import { type DepositToken } from '@/types/constants';

import { createTransactionProperties, getAnalyticsErrorType } from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { depositDialogAtom } from '@/lib/store';
import { AppError, getDepositTransactionData, handleDepositRefetches, handlePromise } from '@/lib/utils';

import useTx, { parseReceiptEvent, type TxParams } from '@/hooks/useTx';

export type RouterDepositPermitToken = Extract<DepositToken, 'USDC' | 'frxUSD'>;
export type RouterDepositPermitParams = TxParams<typeof zivoeRouterAbi, 'depositWithPermit'>;

type RouterDepositPermitVariables = { stableCoinName: RouterDepositPermitToken; amount?: bigint };

export const useRouterDepositPermit = () => {
  const publicClient = usePublicClient();
  const analytics = useAnalytics();
  const { data: walletClient } = useWalletClient({ query: { retry: 0, meta: { skipErrorToast: true } } });
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const [isPermitPending, setIsPermitPending] = useState(false);

  const tx = useTx<RouterDepositPermitVariables, RouterDepositPermitParams>({
    buildParams: async ({ stableCoinName, amount }, { address }) => {
      if (!walletClient || !publicClient || !address) throw new AppError({ message: 'Client or address not found' });
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

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

      const params: RouterDepositPermitParams = {
        abi: zivoeRouterAbi,
        address: CONTRACTS.zRTR,
        functionName: 'depositWithPermit',
        args: [address, CONTRACTS[stableCoinName], amount, deadline, v, r, s]
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
    sentryFlow: 'router-deposit-permit',

    transactionData: (receipt, { stableCoinName }) =>
      getDepositTransactionData({
        stableCoinName,
        receipt,
        getDepositAmount: () => {
          const seniorDepositLog = parseReceiptEvent({
            receipt,
            abi: zivoeTranchesAbi,
            eventName: 'SeniorDeposit',
            sentryFlow: 'router-deposit-permit'
          });

          return seniorDepositLog?.args.amount;
        }
      }),

    onSuccessClose: () => setIsDepositDialogOpen(false),

    invalidate: ({ queryClient, address, vars }) =>
      handleDepositRefetches({
        queryClient,
        address,
        stableCoinName: vars.stableCoinName,
        allowanceSpender: undefined
      })
  });

  return {
    ...tx,
    isPermitPending
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
