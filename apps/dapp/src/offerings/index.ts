import { SHARE_CLASS_CATALOG, type ShareClassKey, getShareClassIdentity } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

// Type-only on purpose: server components import this module, and runtime
// @/centrifuge code beyond config.ts is client-only.
import { type TransactionIdentity } from '@/centrifuge/types';

import { assertOfferingRegistryInvariants } from './invariants';
import { type Offering } from './offering';
import { ZALT_OFFERING } from './zalt';
import { ZSMB_OFFERING } from './zsmb';

// The identity/presentation halves and the Centrifuge-vault shape stay internal to
// offering.ts — they document the serialization boundary there, and no
// consumer composes with them directly.
export {
  OFFERING_DETAIL_LABELS,
  type DerivedDetailLabel,
  type Offering,
  type OfferingDetailLabel,
  type OfferingStatus
} from './offering';
export { offeringNetworkDisplays } from './network-display';
export { ZALT_OFFERING } from './zalt';
export { ZSMB_OFFERING } from './zsmb';

/**
 * Every Offering module, keyed by its share class. `satisfies` over the
 * catalog's key union makes the compiler demand a module for every catalog
 * entry — a class cannot enter the catalog (and the aggregated NAV read)
 * without the module that gives it a card, a route, and display info.
 */
const REGISTERED_OFFERINGS = {
  zsmb: ZSMB_OFFERING,
  zalt: ZALT_OFFERING
} satisfies Record<ShareClassKey, Offering>;

const ALL_OFFERINGS: Array<Offering> = Object.values(REGISTERED_OFFERINGS);

// The invariants take the record itself, so record-key/module agreement is
// checked in the same tested module as every other registration guard.
assertOfferingRegistryInvariants({ offerings: REGISTERED_OFFERINGS });

/**
 * The Offerings this deployment serves: registered modules whose catalog
 * entry and Centrifuge vault are both live on the active network. Half-claims and
 * placeholder values under a deployable flag have already thrown in the
 * invariants, so this filter expresses availability only — an Offering
 * absent or staged on the network is simply not listed.
 */
export const OFFERINGS: Array<Offering> = ALL_OFFERINGS.filter((offering) => {
  const network = env.NEXT_PUBLIC_NETWORK;
  const catalogEntry = SHARE_CLASS_CATALOG[offering.shareClass.key].networks[network];
  return Boolean(catalogEntry?.deployable && offering.centrifugeVaults[network]?.deployable);
});

// The dApp's product IS its Offerings: a deployment serving none is a
// misconfigured cutover (flags not flipped for the active network), not an
// empty book — fail the build/boot loudly instead of rendering a shell.
if (OFFERINGS.length === 0)
  throw new Error(
    `No Offering is live on "${env.NEXT_PUBLIC_NETWORK}". Flip the catalog and Centrifuge-vault deployable flags for the network before deploying.`
  );

export function getOffering(slug: string): Offering | undefined {
  return OFFERINGS.find((offering) => offering.slug === slug);
}

/**
 * Resolves an Offering's transaction identity on the active network — what
 * flows hand to every Centrifuge Module hook: the catalog identity joined
 * with the Offering's own Centrifuge vault, plus the stable public identity for
 * analytics and Sentry. Throws for a network the Offering is not live on.
 */
export function resolveTransactionIdentity(
  offering: Pick<Offering, 'slug' | 'shareClass' | 'centrifugeVaults'>
): TransactionIdentity {
  const network = env.NEXT_PUBLIC_NETWORK;
  const identity = getShareClassIdentity({ network, key: offering.shareClass.key });
  const centrifugeVault = offering.centrifugeVaults[network];

  if (!centrifugeVault?.deployable)
    throw new Error(`The "${offering.slug}" Offering has no deployable Centrifuge vault on "${network}".`);

  return { offeringSlug: offering.slug, shareClass: { ...identity, centrifugeVaultAddress: centrifugeVault.address } };
}

export const OFFERING_PATH_PREFIX = '/vaults';

export function offeringPath(offering: Pick<Offering, 'slug'>): string {
  return `${OFFERING_PATH_PREFIX}/${offering.slug}`;
}

export function isOfferingPath(pathname: string): boolean {
  return pathname.startsWith(`${OFFERING_PATH_PREFIX}/`);
}
