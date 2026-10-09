'use client';

import { useEffect, useState } from 'react';

/**
 * How long a surface waits for every chain to answer before it shows what has
 * landed and names the chains still reading. Measured on mainnet on
 * 2026-10-06 over eleven page loads: the slowest chain (Pharos, five
 * sequential reads at 300–500 ms each) answered its last read 2.2 s after
 * the wallet was known at the median and 2.9 s at worst; every other chain
 * was done inside 1.5 s. A chain still silent past this window is slow or
 * down, and saying so beats a figure that keeps changing under the reader.
 */
export const SETTLE_WINDOW_MS = 3_500;

/**
 * True while reads are still on their first answer and the window has not
 * run out — the caller keeps its skeleton up rather than print partial
 * figures. A failed read is not pending, so an outage surfaces as soon as
 * the transport gives up, window or not. The window restarts whenever a new
 * set of reads begins (another wallet, a changed query key).
 */
export function useSettleWindow({
  isPending,
  windowMs = SETTLE_WINDOW_MS
}: {
  isPending: boolean;
  windowMs?: number;
}): boolean {
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setHasExpired(false);
      return;
    }
    const timer = setTimeout(() => setHasExpired(true), windowMs);
    return () => clearTimeout(timer);
  }, [isPending, windowMs]);

  return isPending && !hasExpired;
}

/**
 * A read as the window should count it. TanStack puts a query that has
 * nothing cached back to `pending` for the length of every retry of a failed
 * read (its error backoff, or a new observer mounting), which would re-arm
 * the window and hide every answered chain behind the skeleton on each
 * retry — on the Pending tab for good, since the strips mounting is what
 * triggers the retry. So a read that has failed and still has nothing stays
 * a failure here, and only a read with no answer of any kind is pending.
 */
export function readState<T>(result: { data: T | undefined; isError: boolean; errorUpdateCount: number }): {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
} {
  const isError = result.isError || (result.data === undefined && result.errorUpdateCount > 0);
  return { data: result.data, isError, isPending: result.data === undefined && !isError };
}
