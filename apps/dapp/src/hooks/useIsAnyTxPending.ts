'use client';

import { useAtomValue } from 'jotai';

import { pendingTxCountAtom } from '@/lib/store';

/**
 * True while any Transaction Hook mutation is in flight, wherever it was
 * started. Every write shares one wallet prompt and the Centrifuge SDK's
 * signer lock, so a second write offered mid-signature would only reach the
 * lock's error. Counted on the mutation (see pendingTxCountAtom), so the gate
 * holds across tab switches.
 */
export function useIsAnyTxPending(): boolean {
  return useAtomValue(pendingTxCountAtom) > 0;
}

/** What a control shows while it waits out a write started elsewhere; it cannot tell whose. */
export const OTHER_WRITE_PENDING_LABEL = 'Another transaction in progress...';
