import { type Offering } from './offering';
import { ZMCA_OFFERING } from './zmca';

export {
  OFFERING_DETAIL_LABELS,
  type Offering,
  type OfferingDetailLabel,
  type OfferingDetailValue,
  type OfferingIdentity,
  type OfferingPresentation
} from './offering';

/**
 * The registry is a thin index of the per-Offering modules — content and
 * identity live in each module, never here.
 */
export const OFFERINGS: Array<Offering> = [ZMCA_OFFERING];

// Share-class identity is still a module-level singleton below the route
// (CENTRIFUGE_CONFIG, the memoized vault, and the unparameterized query and
// unstable_cache keys). Until that is threaded per share class, a second entry
// here would silently serve the first entry's charts, stats and vault under
// its own URL — so fail at import time instead.
if (OFFERINGS.length > 1)
  throw new Error(
    'The Centrifuge data layer is still single-share-class. Parameterize CENTRIFUGE_CONFIG, the vault client, the query keys and the unstable_cache keys by share class before registering a second Offering.'
  );

export function getOffering(slug: string): Offering | undefined {
  return OFFERINGS.find((offering) => offering.slug === slug);
}

export const OFFERING_PATH_PREFIX = '/offerings';

export function offeringPath(offering: Pick<Offering, 'slug'>): string {
  return `${OFFERING_PATH_PREFIX}/${offering.slug}`;
}

export function isOfferingPath(pathname: string): boolean {
  return pathname.startsWith(`${OFFERING_PATH_PREFIX}/`);
}
