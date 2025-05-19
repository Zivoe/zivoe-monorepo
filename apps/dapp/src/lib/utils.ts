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
