'use client';

import { useAtomValue } from 'jotai';

import { pendingTxCountAtom } from '@/lib/store';

/**
 * True while any Transaction Hook mutation is in flight, wherever it was
 * started — the tab-wide "another transaction is running" gate. Every write
 * shares one wallet prompt and the Centrifuge SDK's single signer lock, so a
 * control offering a second write while one signs would only reach the
 * lock's error. The lifecycle counts the mutation itself (see
 * pendingTxCountAtom), so the gate holds across tab switches that unmount
 * the component that started the write.
 */
export function useIsAnyTxPending(): boolean {
  return useAtomValue(pendingTxCountAtom) > 0;
}
