'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';

import { type TransactionIdentity } from '@/centrifuge';
// The module rather than the barrel: this is a client component, and the
// barrel runs the registry invariants and reads env at import.
import { type ZivoeVaultStatus } from '@/zivoe-vaults/zivoe-vault';

type ZivoeVaultContextValue = { identity: TransactionIdentity; status: ZivoeVaultStatus };

const ZivoeVaultContext = createContext<ZivoeVaultContextValue | null>(null);

/**
 * Hands the route-resolved Zivoe Vault identity and its subscription status to
 * the page's client trees. The value is serializable plain data only —
 * components, rich content and other server-only presentation never cross
 * this boundary.
 */
export function ZivoeVaultIdentityProvider({
  identity,
  status,
  children
}: ZivoeVaultContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ identity, status }), [identity, status]);

  return <ZivoeVaultContext.Provider value={value}>{children}</ZivoeVaultContext.Provider>;
}

function useZivoeVaultContext(): ZivoeVaultContextValue {
  const value = useContext(ZivoeVaultContext);
  if (!value) throw new Error('useZivoeVaultIdentity must be used under a Zivoe Vault page.');
  return value;
}

/** The page's Zivoe Vault identity — every flow reads it once and hands it to the hooks. */
export function useZivoeVaultIdentity(): TransactionIdentity {
  return useZivoeVaultContext().identity;
}

/** The page's subscription status — 'Deploying' gates new deposits, redemptions stay open. */
export function useZivoeVaultStatus(): ZivoeVaultStatus {
  return useZivoeVaultContext().status;
}
