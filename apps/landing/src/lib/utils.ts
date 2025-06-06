import { formatUnits } from 'viem';

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
