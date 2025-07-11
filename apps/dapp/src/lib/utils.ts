import { QueryClient } from '@tanstack/react-query';
import { Address, TransactionReceipt, formatUnits, parseEventLogs } from 'viem';

import { zivoeVaultAbi } from '@zivoe/contracts/abis';
import { toast } from '@zivoe/ui/core/sonner';

import { DepositToken } from '@/types/constants';

import { TransactionData } from '@/lib/store';

import { CONTRACTS } from './constants';
import { queryKeys } from './query-keys';

export const handle = <T>(promise: Promise<T>) => {
  return promise
    .then((data: T) => ({
      data,
      err: undefined
    }))
    .catch((err: unknown) => Promise.resolve({ data: undefined, err }));
};

export const DAY_IN_SECONDS = 86400;
export const DAYS_PER_YEAR = 365;

export const truncateAddress = (address: string | undefined) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function customNumber(number: number, decimals: number = 2) {
  if (number >= 1_000_000) return `${floorToDecimals(number / 1_000_000, decimals)}M`;
  else if (number >= 1_000) return `${floorToDecimals(number / 1_000, decimals)}k`;
  else {
    return floorToDecimals(number, decimals);
  }
}

export const formatBigIntToReadable = (value: bigint, decimals?: number) => {
  const inEther = formatUnits(value, decimals ?? 18);
  const numericValue = Number(inEther);

  if (numericValue >= 1_000_000) {
    return `${floorToDecimals(numericValue / 1_000_000)}M`;
  } else if (numericValue >= 1_000) {
    return `${floorToDecimals(numericValue / 1_000)}k`;
  } else {
    return floorToDecimals(numericValue);
  }
};

const floorToDecimals = (num: number, decimals: number = 2) => {
  const multiplier = Math.pow(10, decimals);
  return (Math.floor(num * multiplier) / multiplier).toFixed(decimals);
};

export function handlePromise<T>(promise: Promise<T>) {
  return promise
    .then((res: T) => ({ res, err: undefined }))
    .catch((err: unknown) => Promise.resolve({ res: undefined, err }));
}

export class AppError extends Error {
  public readonly refetch: boolean;

  constructor({ message, refetch = true }: { message: string; refetch?: boolean }) {
    super(message);
    this.name = 'AppError';
    this.refetch = refetch;
  }
}

export const onTxError = ({
  err,
  defaultToastMsg,
  onRefetch
}: {
  err: unknown;
  defaultToastMsg: string;
  onRefetch?: () => Promise<void>;
}) => {
  let refetch = true;
  let toastMsg = defaultToastMsg;

  if (err instanceof AppError) {
    refetch = err.refetch;
    toastMsg = err.message;
  }

  toast({ type: 'error', title: toastMsg });
  if (refetch && onRefetch) onRefetch();
};

export const skipTxSettled = (err: unknown) => {
  return !!err && err instanceof AppError && err.refetch === false;
};

export const getDepositTransactionData = ({
  stableCoinName,
  receipt,
  getDepositAmount
}: {
  stableCoinName: DepositToken;
  receipt: TransactionReceipt;
  getDepositAmount: () => bigint | undefined;
}) => {
  let depositAmount: bigint | undefined;
  let receiveAmount: bigint | undefined;

  try {
    depositAmount = getDepositAmount();

    const vaultDepositLogs = parseEventLogs({
      abi: zivoeVaultAbi,
      eventName: 'Deposit',
      logs: receipt.logs
    });

    const vaultDepositLog = vaultDepositLogs[0];
    if (vaultDepositLog) receiveAmount = vaultDepositLog.args.shares;
  } catch (error) {
    console.error('Error parsing deposit receipt', error);
  }

  let meta: TransactionData['meta'] = undefined;
  if (depositAmount && receiveAmount) {
    meta = {
      deposit: {
        token: stableCoinName,
        amount: depositAmount,
        receive: receiveAmount
      }
    };
  }

  const transactionData: TransactionData =
    receipt.status === 'success'
      ? {
          type: 'SUCCESS',
          title: 'Deposit Successful',
          description: 'zVLT tokens have been transferred to your wallet.',
          hash: receipt.transactionHash,
          meta
        }
      : {
          type: 'ERROR',
          title: 'Deposit Failed',
          description: `There was an error depositing ${stableCoinName}`,
          hash: receipt.transactionHash
        };

  return transactionData;
};

export const handleDepositRefetches = ({
  queryClient,
  address,
  stableCoinName,
  allowanceSpender
}: {
  queryClient: QueryClient;
  address: Address | undefined;
  stableCoinName: DepositToken;
  allowanceSpender: Address | undefined;
}) => {
  // Refetch allowance
  if (allowanceSpender) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.account.allowance({
        accountAddress: address,
        contract: CONTRACTS[stableCoinName],
        spender: allowanceSpender
      })
    });
  }

  // Refetch deposit balances
  queryClient.invalidateQueries({
    queryKey: queryKeys.account.depositBalances({ accountAddress: address })
  });

  // Refetch zVLT balance
  queryClient.invalidateQueries({
    queryKey: queryKeys.account.balanceOf({ accountAddress: address, id: CONTRACTS.zVLT })
  });
};
