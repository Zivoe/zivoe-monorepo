'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';

import { type TransactionIdentity } from '@/centrifuge';
// The module rather than the barrel: this is a client component, and the
// barrel runs the registry invariants and reads env at import.
import { type OfferingStatus } from '@/offerings/offering';

type OfferingContextValue = { identity: TransactionIdentity; status: OfferingStatus };

const OfferingContext = createContext<OfferingContextValue | null>(null);

/**
 * Hands the route-resolved Offering identity and its subscription status to
 * the page's client trees. The value is serializable plain data only —
 * components, rich content and other server-only presentation never cross
 * this boundary.
 */
export function OfferingIdentityProvider({
  identity,
  status,
  children
}: OfferingContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ identity, status }), [identity, status]);

  return <OfferingContext.Provider value={value}>{children}</OfferingContext.Provider>;
}

function useOfferingContext(): OfferingContextValue {
  const value = useContext(OfferingContext);
  if (!value) throw new Error('useOfferingIdentity must be used under an Offering page.');
  return value;
}

/** The page's Offering identity — every flow reads it once and hands it to the hooks. */
export function useOfferingIdentity(): TransactionIdentity {
  return useOfferingContext().identity;
}

/** The page's subscription status — 'Closed' gates new deposits, redemptions stay open. */
export function useOfferingStatus(): OfferingStatus {
  return useOfferingContext().status;
}
