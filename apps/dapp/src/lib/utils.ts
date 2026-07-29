import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { formatUnits } from 'viem';

import { toast } from '@zivoe/ui/core/sonner';

import { env } from '@/env';

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

export const formatBigIntWithCommas = ({
  value,
  tokenDecimals = 18,
  displayDecimals = 2,
  showUnderZero = false
}: {
  value: bigint;
  tokenDecimals?: number;
  displayDecimals?: number;
  showUnderZero?: boolean;
}) => {
  const inEther = formatUnits(value, tokenDecimals);
  const numericValue = Number(inEther);

  const multiplier = Math.pow(10, displayDecimals);
  const rounded = Math.floor(numericValue * multiplier) / multiplier;

  const formatted = rounded.toLocaleString('en-US', {
    minimumFractionDigits: displayDecimals,
    maximumFractionDigits: displayDecimals
  });

  return showUnderZero && value !== 0n && displayDecimals === 2 && formatted === '0.00' ? '<0.01' : formatted;
};

const floorToDecimals = (num: number, decimals = 2) => {
  const multiplier = Math.pow(10, decimals);
  // Scaling first introduces representation error (1.14 * 100 is
  // 113.99999999999999), which floors a whole cent off the value. Round that
  // noise away before flooring; it is ~1e-13 relative, far below the last
  // shown digit, so genuine excess precision is still floored, not rounded up.
  return (Math.floor(Math.round(num * multiplier * 1000) / 1000) / multiplier).toFixed(decimals);
};

export const roundTo4 = (n: number) => Math.round(n * 10000) / 10000;

const HTML_ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };
export function escapeHtml(text: string): string {
  return text.replace(/[<>&]/g, (c) => HTML_ENTITIES[c] ?? c);
}

export function handlePromise<T>(promise: Promise<T>) {
  return promise
    .then((res: T) => ({ res, err: undefined }))
    .catch((err: unknown) => Promise.resolve({ res: undefined, err }));
}

export class ApiError extends Error {
  public readonly capture: boolean;
  public readonly exception?: unknown;
  public readonly status: number;
  public readonly headers?: HeadersInit;

  constructor({
    message,
    capture = true,
    exception,
    status,
    headers
  }: {
    message: string;
    capture?: boolean;
    exception?: unknown;
    status?: number;
    headers?: HeadersInit;
  }) {
    super(message);
    this.name = 'ApiError';
    this.capture = capture;
    this.exception = exception;
    this.status = status ?? 500;
    this.headers = headers;
  }
}

type AppErrorType = 'warning' | 'error';
export class AppError extends Error {
  public readonly refetch: boolean;
  public readonly capture: boolean;
  public readonly exception?: unknown;
  public readonly type: AppErrorType;
  /** True when the pre-sign simulation blocked the transaction — analytics classify these as simulation_failed, not failed. */
  public readonly simulation: boolean;

  constructor({
    message,
    refetch = true,
    capture = true,
    exception,
    type = 'error',
    simulation = false
  }: {
    message: string;
    refetch?: boolean;
    capture?: boolean;
    exception?: unknown;
    type?: AppErrorType;
    simulation?: boolean;
  }) {
    super(message);
    this.name = 'AppError';
    this.refetch = refetch;
    this.capture = capture;
    this.exception = exception;
    this.type = type;
    this.simulation = simulation;
  }
}

export const onTxError = ({
  err,
  defaultToastMsg,
  onRefetch,
  sentry
}: {
  err: unknown;
  defaultToastMsg: string;
  onRefetch?: () => Promise<void>;
  sentry: { flow: string; extras: Record<string, unknown> };
}) => {
  let refetch = true;
  let capture = true;
  let toastMsg = defaultToastMsg;
  let exception: unknown = err;
  let type: AppErrorType = 'error';

  if (err instanceof AppError) {
    refetch = err.refetch;
    capture = err.capture;
    toastMsg = err.message;
    // Fall back to the AppError itself (not its message) so guard failures
    // reach Sentry with a stack and error class instead of a bare string.
    exception = err.exception ?? err;
    type = err.type;
  }

  if (type === 'warning') toast({ type: 'warning', title: toastMsg });
  else toast({ type: 'error', title: toastMsg });

  if (refetch && onRefetch) void onRefetch();

  if (capture)
    Sentry.captureException(exception, {
      tags: { source: 'MUTATION', flow: sentry.flow },
      extra: {
        ...sentry.extras,
        toastMsg
      }
    });
};

export const skipTxSettled = (err: unknown) => {
  return !!err && err instanceof AppError && err.refetch === false;
};

export function withErrorHandler(defaultErrorMessage: string, handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { res, err } = await handlePromise(handler(req));
    if (!err && res) return res;

    let status = 500;
    let capture = true;
    let errorMessage = defaultErrorMessage;
    let exception: unknown = err;
    let headers: HeadersInit | undefined = undefined;

    if (err instanceof ApiError) {
      capture = err.capture;
      errorMessage = err.message;
      exception = err.exception ?? err.message;
      status = err.status;
      headers = err.headers;
    }

    if (capture) {
      if (env.NEXT_PUBLIC_ENV === 'development') console.log('Capturing exception: ', exception);
      Sentry.captureException(exception, {
        tags: { source: 'API' },
        extra: { errorMessage, status }
      });
    }

    return NextResponse.json({ error: errorMessage }, { status, headers });
  };
}

export const getEndOfDayUTC = (date: Date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

export const EMAILS = {
  INVESTORS: 'investors@zivoe.com',
  INQUIRE: 'inquire@zivoe.com'
} as const;
