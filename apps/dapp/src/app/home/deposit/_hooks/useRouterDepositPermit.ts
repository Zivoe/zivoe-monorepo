import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { SimulateContractParameters, hexToNumber, parseEventLogs, slice } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { usePublicClient, useWalletClient } from 'wagmi';
import { WriteContractParameters } from 'wagmi/actions';

import { Network } from '@zivoe/contracts';
import { erc20PermitAbi, zivoeRouterAbi, zivoeTranchesAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { CONTRACTS, NETWORK } from '@/lib/constants';
import { transactionAtom } from '@/lib/store';
import { AppError, getDepositTransactionData, handleDepositRefetches, onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import useTx from '@/hooks/useTx';

export type RouterDepositPermitToken = Extract<DepositToken, 'USDC' | 'frxUSD'>;
export type RouterDepositPermitParams = WriteContractParameters<typeof zivoeRouterAbi, 'depositWithPermit'>;

export const useRouterDepositPermit = () => {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient({ query: { retry: 0, meta: { skipErrorToast: true } } });
  const queryClient = useQueryClient();
  const setTransaction = useSetAtom(transactionAtom);

  const { address } = useAccount();

  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const [isPermitPending, setIsPermitPending] = useState(false);

  const mutationInfo = useMutation({
    mutationFn: async ({ stableCoinName, amount }: { stableCoinName: RouterDepositPermitToken; amount?: bigint }) => {
      if (!walletClient || !publicClient || !address) throw new AppError({ message: 'Client or address not found' });
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

      setIsPermitPending(true);

      const nonce = await publicClient.readContract({
        address: CONTRACTS[stableCoinName],
        abi: erc20PermitAbi,
        functionName: 'nonces',
        args: [address]
      });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 minutes from now

      const signature = await walletClient.signTypedData({
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
          ...DOMAIN[NETWORK][stableCoinName],
          verifyingContract: CONTRACTS[stableCoinName]
        }
      });

      setIsPermitPending(false);

      const v = hexToNumber(slice(signature, 64, 65));
      const r = slice(signature, 0, 32);
      const s = slice(signature, 32, 64);

      const params: RouterDepositPermitParams & SimulateContractParameters = {
        abi: zivoeRouterAbi,
        address: CONTRACTS.zRTR,
        functionName: 'depositWithPermit',
        args: [address, CONTRACTS[stableCoinName], amount, deadline, v, r, s]
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

const DOMAIN: Record<Network, Record<RouterDepositPermitToken, { name: string; version: string; chainId: number }>> = {
  MAINNET: {
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
  },

  SEPOLIA: {
    USDC: {
      name: 'USD Coin',
      version: '1',
      chainId: sepolia.id
    },
    frxUSD: {
      name: 'Frax USD',
      version: '1',
      chainId: sepolia.id
    }
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
