import { SHARE_CLASS_CATALOG, type ShareClassKey, getShareClassIdentity } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

// Type-only on purpose: server components import this module, and runtime
// @/centrifuge code beyond config.ts is client-only.
import { type TransactionIdentity } from '@/centrifuge/types';

import { assertOfferingRegistryInvariants } from './invariants';
import { type Offering } from './offering';
import { ZMCA_OFFERING } from './zmca';

export {
  OFFERING_DETAIL_LABELS,
  type Offering,
  type OfferingDetailLabel,
  type OfferingDetailValue,
  type OfferingIdentity,
  type OfferingPresentation,
  type OfferingVault
} from './offering';
export { ZMCA_OFFERING } from './zmca';

/**
 * Every Offering module, keyed by its share class. `satisfies` over the
 * catalog's key union makes the compiler demand a module for every catalog
 * entry — a class cannot enter the catalog (and the aggregated AUM read)
 * without the module that gives it a card, a route, and display info.
 */
const REGISTERED_OFFERINGS = {
  zmca: ZMCA_OFFERING
} satisfies Record<ShareClassKey, Offering>;

const ALL_OFFERINGS: Array<Offering> = Object.values(REGISTERED_OFFERINGS);

// The record key is a claim; the module's own share class is the truth —
// they must agree or class-keyed registration and the module would diverge.
for (const [key, offering] of Object.entries(REGISTERED_OFFERINGS)) {
  if (key !== offering.shareClass.key)
    throw new Error(
      `Offering "${offering.slug}" is registered under "${key}" but declares share class "${offering.shareClass.key}".`
    );
}

assertOfferingRegistryInvariants({ offerings: ALL_OFFERINGS });

/**
 * The Offerings this deployment serves: registered modules whose catalog
 * entry and vault are both live on the active network. Half-claims and
 * placeholder values under a deployable flag have already thrown in the
 * invariants, so this filter expresses availability only — an Offering
 * absent or staged on the network is simply not listed.
 */
export const OFFERINGS: Array<Offering> = ALL_OFFERINGS.filter((offering) => {
  const network = env.NEXT_PUBLIC_NETWORK;
  const catalogEntry = SHARE_CLASS_CATALOG[offering.shareClass.key].networks[network];
  return Boolean(catalogEntry?.deployable && offering.vaults[network]?.deployable);
});

export function getOffering(slug: string): Offering | undefined {
  return OFFERINGS.find((offering) => offering.slug === slug);
}

/**
 * Resolves an Offering's transaction identity on the active network — what
 * flows hand to every Centrifuge Module hook: the catalog identity joined
 * with the Offering's own vault, plus the stable public identity for
 * analytics and Sentry. Throws for a network the Offering is not live on.
 */
export function resolveTransactionIdentity(
  offering: Pick<Offering, 'slug' | 'shareClass' | 'vaults'>
): TransactionIdentity {
  const network = env.NEXT_PUBLIC_NETWORK;
  const identity = getShareClassIdentity({ network, key: offering.shareClass.key });
  const vault = offering.vaults[network];

  if (!vault?.deployable) throw new Error(`The "${offering.slug}" Offering has no deployable vault on "${network}".`);

  return { offeringSlug: offering.slug, shareClass: { ...identity, vaultAddress: vault.address } };
}

export const OFFERING_PATH_PREFIX = '/offerings';

export function offeringPath(offering: Pick<Offering, 'slug'>): string {
  return `${OFFERING_PATH_PREFIX}/${offering.slug}`;
}

export function isOfferingPath(pathname: string): boolean {
  return pathname.startsWith(`${OFFERING_PATH_PREFIX}/`);
}
