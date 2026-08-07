import { SHARE_CLASS_CATALOG } from '@zivoe/centrifuge-indexer';
import { ZMcaLogo } from '@zivoe/ui/icons';

import { type Offering } from './offering';

export { type Offering, type OfferingIdentity, type OfferingPresentation } from './offering';

/**
 * Published Target APY, in percent. A single constant rather than an Offering
 * field while the trailing-yield read is disabled — it becomes per-Offering
 * data once each share class publishes its own target.
 */
export const TARGET_APY_PERCENT = 14;

export const OFFERINGS: Array<Offering> = [
  {
    slug: 'global-mca-offerings',
    name: 'Global MCA Offerings Fund',
    Logo: ZMcaLogo,
    category: 'Merchant Cash Advance',
    description:
      'Short-duration, revenue-based financing for small businesses, diversified across thousands of merchants in the US, UK, Europe and APAC with daily repayment.',
    cardGradient: [
      'radial-gradient(120% 120% at 18% 22%, rgba(255, 216, 174, 0.95), transparent 55%)',
      'radial-gradient(120% 130% at 86% 82%, rgba(224, 99, 143, 0.92), transparent 55%)',
      'linear-gradient(135deg, #f3a25c, #f08f48 45%, #d96b8f)'
    ].join(', '),
    issuer: 'Zivoe',
    // Symbol read off the catalog so the registry cannot drift from the
    // share class it references.
    shareClass: { key: 'zmca', symbol: SHARE_CLASS_CATALOG.zmca.symbol },
    shareTokenDescription: 'Zivoe MCA'
  }
];

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
