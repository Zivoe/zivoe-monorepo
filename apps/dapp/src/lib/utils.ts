export const handle = <T>(promise: Promise<T>) => {
  return promise
    .then((data: T) => ({
      data,
      err: undefined
    }))
    .catch((err: unknown) => Promise.resolve({ data: undefined, err }));
};
