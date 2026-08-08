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
  // Scaling first introduces representation error (1.14 * 100 is
  // 113.99999999999999), which floors a whole cent off the value. Round that
  // noise away before flooring; it is ~1e-13 relative, far below a cent, so
  // genuine sub-cent precision is still floored rather than rounded up.
  return (Math.floor(Math.round(num * 100 * 1000) / 1000) / 100).toFixed(2);
};

export function handlePromise<T>(promise: Promise<T>) {
  return promise
    .then((res: T) => ({ res, err: undefined }))
    .catch((err: unknown) => Promise.resolve({ res: undefined, err }));
}

export const EMAILS = {
  INQUIRE: 'inquire@zivoe.com'
} as const;
