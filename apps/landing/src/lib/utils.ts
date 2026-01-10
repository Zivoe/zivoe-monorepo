import { formatUnits } from 'viem';

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

export const formatBigIntWithCommas = ({
  value,
  tokenDecimals = 18,
  displayDecimals = 2
}: {
  value: bigint;
  tokenDecimals?: number;
  displayDecimals?: number;
}) => {
  const inEther = formatUnits(value, tokenDecimals);
  const numericValue = Number(inEther);

  const multiplier = Math.pow(10, displayDecimals);
  const rounded = Math.floor(numericValue * multiplier) / multiplier;

  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: displayDecimals,
    maximumFractionDigits: displayDecimals
  });
};

const floorToDecimals = (num: number) => {
  return (Math.floor(num * 100) / 100).toFixed(2);
};

export function handlePromise<T>(promise: Promise<T>) {
  return promise
    .then((res: T) => ({ res, err: undefined }))
    .catch((err: unknown) => Promise.resolve({ res: undefined, err }));
}

export const EMAILS = {
  INVESTORS: 'investors@zivoe.com'
} as const;
