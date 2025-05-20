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

export const truncateAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function customNumber(number: number) {
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`;
  else if (number >= 1_000) return `${(number / 1_000).toFixed(2)}k`;
  else {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }
}
