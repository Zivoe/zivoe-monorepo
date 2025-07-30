'use client';

import { useState } from 'react';

import { toast as sonnerToast } from 'sonner';
import { BaseError, ContractFunctionRevertedError, type Hash, type SimulateContractParameters } from 'viem';
import { type WriteContractParameters } from 'viem';
import { usePublicClient } from 'wagmi';
import { useWriteContract } from 'wagmi';

import { toast } from '@zivoe/ui/core/sonner';

import { AppError, handlePromise } from '@/lib/utils';

import { RouterDepositParams } from '@/app/home/deposit/_hooks/useRouterDeposit';
import { RouterDepositPermitParams } from '@/app/home/deposit/_hooks/useRouterDepositPermit';
import { VaultDepositParams } from '@/app/home/deposit/_hooks/useVaultDeposit';

import { useAccount } from './useAccount';
import { ApproveTokenParams } from './useApproveSpending';

export default function useTx() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();

  const [isTxPending, setIsTxPending] = useState(false);

  const simulateTx = async (params: SimulateContractParameters) => {
    if (!publicClient) throw new Error('Public client not found');

    const { err } = await handlePromise(publicClient.simulateContract({ ...params, account: address }));
    if (!err) return;

    console.error('Simulation error: ', err);

    if (err instanceof BaseError) {
      const revertError = err.walk((err) => err instanceof ContractFunctionRevertedError);

      if (revertError instanceof ContractFunctionRevertedError) {
        const revertReason = revertError.reason;
        if (revertReason) throw new AppError({ message: `Simulation error: ${revertReason}`, exception: err });
      }
    }

    throw new AppError({ message: 'Simulation error', exception: err });
  };

  const sendTx = async (
    params: ApproveTokenParams | RouterDepositParams | RouterDepositPermitParams | VaultDepositParams
  ) => {
    const { err, res: hash } = await handlePromise(writeContractAsync(params as WriteContractParameters));

    if (err || !hash) {
      const isUserRejection = err && err instanceof Error && err.message.includes('User rejected the request');
      if (isUserRejection)
        throw new AppError({
          message: 'Transaction rejected',
          exception: err,
          refetch: false,
          type: 'warning',
          capture: false
        });
      else throw err;
    }

    return { hash, sendTx };
  };

  const waitForTxReceipt = async ({ hash, messages }: { hash: Hash; messages: { pending: string } }) => {
    if (!publicClient) throw new Error('Public client not found');

    setIsTxPending(true);
    const toastId = toast({ type: 'pending', title: messages.pending });

    const { err, res: receipt } = await handlePromise(publicClient.waitForTransactionReceipt({ hash }));

    setIsTxPending(false);
    sonnerToast.dismiss(toastId);

    if (err || !receipt) throw new AppError({ message: 'Error checking transaction receipt', exception: err });

    return receipt;
  };

  return { simulateTx, sendTx, waitForTxReceipt, isTxPending };
}
