'use client';

import { useState } from 'react';

import Link from 'next/link';

import { toast } from 'sonner';
import {
  BaseError,
  ContractFunctionRevertedError,
  type Hash,
  type SimulateContractParameters,
  UserRejectedRequestError
} from 'viem';
import { type WriteContractParameters } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { useAccount, usePublicClient } from 'wagmi';
import { useWriteContract } from 'wagmi';

import { ArrowRightIcon } from '@zivoe/ui/icons';

import { NETWORK } from '@/lib/constants';
import { AppError, handlePromise } from '@/lib/utils';

import { RouterDepositParams } from '@/app/home/deposit/_hooks/useRouterDeposit';

import { ApproveTokenParams } from './useApproveSpending';

export const EXPLORER_URL =
  NETWORK === 'SEPOLIA' ? sepolia.blockExplorers.default.url : mainnet.blockExplorers.default.url;

export default function useTx() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { address } = useAccount();

  const [isTxPending, setIsTxPending] = useState(false);

  const simulateTx = async (params: SimulateContractParameters) => {
    if (!publicClient) throw new Error('Public client not found');

    const { err } = await handlePromise(publicClient.simulateContract({ ...params, account: address }));
    if (!err) return;

    if (err instanceof BaseError) {
      const revertError = err.walk((err) => err instanceof ContractFunctionRevertedError);

      if (revertError instanceof ContractFunctionRevertedError) {
        const revertReason = revertError.reason;
        if (revertReason) throw new AppError({ message: `Simulation error: ${revertReason}` });
      }
    }

    throw new AppError({ message: 'Simulation error' });
  };

  const sendTx = async (params: ApproveTokenParams | RouterDepositParams) => {
    const { err, res: hash } = await handlePromise(writeContractAsync(params as WriteContractParameters));

    if (err || !hash) {
      const isUserRejection = err && err instanceof Error && err.message.includes('User rejected the request');
      if (isUserRejection) throw new AppError({ message: 'Transaction rejected', refetch: false });
      else throw err;
    }

    return { hash, sendTx };
  };

  const waitForTxReceipt = async ({
    hash,
    messages
  }: {
    hash: Hash;
    messages: { pending: string; success: string };
  }) => {
    if (!publicClient) throw new Error('Public client not found');

    setIsTxPending(true);
    const toastId = toast.loading(messages.pending);

    const { err, res: receipt } = await handlePromise(publicClient.waitForTransactionReceipt({ hash }));

    setIsTxPending(false);
    toast.dismiss(toastId);

    if (err || !receipt) throw new AppError({ message: 'Error checking transaction receipt' });
    if (receipt.status === 'reverted') throw new AppError({ message: 'Transaction reverted' });

    toast.success(messages.success, {
      description: <ToastLink href={`${EXPLORER_URL}/tx/${hash}`}>View on Etherscan</ToastLink>
    });

    return receipt;
  };

  return { simulateTx, sendTx, waitForTxReceipt, isTxPending };
}

const ToastLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <Link className="flex items-center gap-1 text-small" href={href} target="_blank">
      {children}
      <ArrowRightIcon className="size-4" />
    </Link>
  );
};
