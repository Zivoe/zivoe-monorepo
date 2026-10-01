export function handlePromise<T>(promise: Promise<T>) {
  return promise
    .then((res: T) => ({ res, err: undefined }))
    .catch((err: unknown) => Promise.resolve({ res: undefined, err }));
}

export const EMAILS = {
  INQUIRE: 'inquire@zivoe.com'
} as const;

/** The other Zivoe surfaces the landing links out to. */
export const APP_URL = 'https://app.zivoe.com';
export const LIGHTHOUSE_URL = 'https://lighthouse.zivoe.com';
