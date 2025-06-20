'use client';

import { useState } from 'react';

import { toast } from 'sonner';
import { BaseError, ContractFunctionRevertedError, type Hash, type SimulateContractParameters } from 'viem';
import { type WriteContractParameters } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { useWriteContract } from 'wagmi';

import { AppError, handlePromise } from '@/lib/utils';

import { RouterPermitDepositParams } from '@/app/home/deposit/_hooks/usePermitDeposit';
import { RouterDepositParams } from '@/app/home/deposit/_hooks/useRouterDeposit';
import { VaultDepositParams } from '@/app/home/deposit/_hooks/useVaultDeposit';

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
        if (revertReason) throw new AppError({ message: `Simulation error: ${revertReason}` });
      }
    }

    throw new AppError({ message: 'Simulation error' });
  };

  const sendTx = async (
    params: ApproveTokenParams | RouterDepositParams | RouterPermitDepositParams | VaultDepositParams
  ) => {
    const { err, res: hash } = await handlePromise(writeContractAsync(params as WriteContractParameters));

    if (err || !hash) {
      const isUserRejection = err && err instanceof Error && err.message.includes('User rejected the request');
      if (isUserRejection) throw new AppError({ message: 'Transaction rejected', refetch: false });
      else throw err;
    }

    return { hash, sendTx };
  };

  const waitForTxReceipt = async ({ hash, messages }: { hash: Hash; messages: { pending: string } }) => {
    if (!publicClient) throw new Error('Public client not found');

    setIsTxPending(true);
    const toastId = toast.loading(messages.pending);

    const { err, res: receipt } = await handlePromise(publicClient.waitForTransactionReceipt({ hash }));

    setIsTxPending(false);
    toast.dismiss(toastId);

    if (err || !receipt) throw new AppError({ message: 'Error checking transaction receipt' });
    // if (receipt.status === 'reverted') throw new AppError({ message: 'Transaction reverted' });

    // TODO: Remove if not needed for mobile transactions
    // toast.success(messages.success, {
    //   description: <ToastLink href={`${EXPLORER_URL}/tx/${hash}`}>View on Etherscan</ToastLink>
    // });

    return receipt;
  };

  return { simulateTx, sendTx, waitForTxReceipt, isTxPending };
}

// TODO: Remove if not needed for mobile transactions
// const ToastLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
//   return (
//     <Link className="flex items-center gap-1 text-small" href={href} target="_blank">
//       {children}
//       <ArrowRightIcon className="size-4" />
//     </Link>
//   );
// };
