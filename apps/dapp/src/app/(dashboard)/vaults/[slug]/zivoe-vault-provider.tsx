'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';

import { type TransactionIdentity } from '@/centrifuge';
// The module rather than the barrel: this is a client component, and the
// barrel runs the registry invariants and reads env at import.
import { type ZivoeVaultStatus } from '@/zivoe-vaults/zivoe-vault';

type ZivoeVaultContextValue = {
  /**
   * One resolved identity per live chain, in deployment order — the single
   * source the flows derive both the selector domain and the selected
   * identity from, so a chain with no identity is unrepresentable. Non-empty
   * by type: the registry throws before a chainless Zivoe Vault reaches a
   * page. Resolved server-side so client trees stay on serializable plain
   * data.
   */
  identities: [TransactionIdentity, ...Array<TransactionIdentity>];
  status: ZivoeVaultStatus;
};

const ZivoeVaultContext = createContext<ZivoeVaultContextValue | null>(null);

/**
 * Hands the route-resolved Zivoe Vault identities (one per live chain) and
 * the subscription status to the page's client trees. The value is
 * serializable plain data only — components, rich content and other
 * server-only presentation never cross this boundary.
 */
export function ZivoeVaultIdentityProvider({
  identities,
  status,
  children
}: ZivoeVaultContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ identities, status }), [identities, status]);

  return <ZivoeVaultContext.Provider value={value}>{children}</ZivoeVaultContext.Provider>;
}

function useZivoeVaultContext(): ZivoeVaultContextValue {
  const value = useContext(ZivoeVaultContext);
  if (!value) throw new Error('useZivoeVaultIdentities must be used under a Zivoe Vault page.');
  return value;
}

/** The Zivoe Vault's identities, one per live chain in deployment order — the flows' selector domain. */
export function useZivoeVaultIdentities(): [TransactionIdentity, ...Array<TransactionIdentity>] {
  return useZivoeVaultContext().identities;
}

/** The page's subscription status — 'Deploying' gates new deposits, redemptions stay open. */
export function useZivoeVaultStatus(): ZivoeVaultStatus {
  return useZivoeVaultContext().status;
}
