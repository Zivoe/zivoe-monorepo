export function handlePromise<T>(promise: Promise<T>) {
  return promise
    .then((res: T) => ({ res, err: undefined }))
    .catch((err: unknown) => Promise.resolve({ res: undefined, err }));
}

export const EMAILS = {
  INQUIRE: 'inquire@zivoe.com'
} as const;
