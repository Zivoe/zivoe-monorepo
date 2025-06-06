import { toast } from 'sonner';
import { formatUnits } from 'viem';

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

export function customNumber(number: number) {
  if (number >= 1_000_000) return `${floorToDecimals(number / 1_000_000)}M`;
  else if (number >= 1_000) return `${floorToDecimals(number / 1_000)}k`;
  else {
    return floorToDecimals(number);
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

const floorToDecimals = (num: number) => {
  return (Math.floor(num * 100) / 100).toFixed(2);
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

  toast.error(toastMsg);
  if (refetch && onRefetch) onRefetch();
};

export const skipTxSettled = (err: unknown) => {
  return !!err && err instanceof AppError && err.refetch === false;
};
