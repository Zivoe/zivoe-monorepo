'use client';

import { useEffect } from 'react';

import { atom, useAtomValue, useSetAtom } from 'jotai';

/**
 * Which redeem-tab writes are in flight, by caller-chosen id. The tab's
 * writes (a request into one Centrifuge vault, claims and cancels on every
 * vault of the chain) live in separate components once a chain has several
 * vaults, yet they share one transaction path — the SDK signer is a single
 * global lock — so each control has to wait out the others wherever they
 * are mounted. Module-private: the two hooks below are its only interface.
 */
const pendingWritesAtom = atom<Record<string, true>>({});

/** Registers `id` as pending while `isPending` holds; a component unmounting mid-write releases it. */
export function useReportPendingWrite(id: string, isPending: boolean) {
  const setPendingWrites = useSetAtom(pendingWritesAtom);

  useEffect(() => {
    if (!isPending) return;
    setPendingWrites((pending) => ({ ...pending, [id]: true }));
    return () =>
      setPendingWrites((pending) => {
        const { [id]: _released, ...rest } = pending;
        return rest;
      });
  }, [id, isPending, setPendingWrites]);
}

/** True while any reported write is in flight — the tab-wide "another transaction is running" gate. */
export function useIsAnyWritePending(): boolean {
  return Object.keys(useAtomValue(pendingWritesAtom)).length > 0;
}
