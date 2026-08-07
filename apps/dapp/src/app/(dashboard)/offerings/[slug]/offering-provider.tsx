'use client';

import { type ReactNode, createContext, useContext } from 'react';

import { type TransactionIdentity } from '@/centrifuge';

const OfferingIdentityContext = createContext<TransactionIdentity | null>(null);

/**
 * Hands the route-resolved Offering identity to the page's client trees. The
 * value is the serializable identity object only — components, rich content
 * and other server-only presentation never cross this boundary.
 */
export function OfferingIdentityProvider({
  identity,
  children
}: {
  identity: TransactionIdentity;
  children: ReactNode;
}) {
  return <OfferingIdentityContext.Provider value={identity}>{children}</OfferingIdentityContext.Provider>;
}

/** The page's Offering identity — every flow reads it once and hands it to the hooks. */
export function useOfferingIdentity(): TransactionIdentity {
  const identity = useContext(OfferingIdentityContext);
  if (!identity) throw new Error('useOfferingIdentity must be used under an Offering page.');
  return identity;
}
