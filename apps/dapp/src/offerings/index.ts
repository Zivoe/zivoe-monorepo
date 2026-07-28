import { type ComponentType } from 'react';

import { ZMcaLogo } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { type DepositToken, type ShareToken } from '@/types/constants';

import { CENTRIFUGE_CONFIG } from '@/centrifuge';

/**
 * One Offering is one Centrifuge share class, exposed at /offerings/<slug>.
 *
 * Centrifuge's model is Pool > Share Class > Vault: a pool holds N share
 * classes (tranches, each with its own share token, price, AUM and yield
 * history), and a vault is one share class instantiated on one network for one
 * deposit asset. A route is therefore keyed by share class, not by vault — the
 * same class accepting a second stablecoin stays one Offering, which is also
 * why the URL says offerings rather than vaults.
 */
export type Offering = {
  /** Permanent public URL segment — it ends up in emails and external links. */
  slug: string;
  name: string;
  Logo: ComponentType<IconProps>;
  /** Asset class, shown as the listing card's eyebrow. */
  category: string;
  /** The listing card's blurb — the page itself carries the long-form About. */
  description: string;
  /**
   * CSS `background` for the listing card's banner. A raw value rather than a
   * token: each Offering gets its own multi-layer gradient so cards stay
   * distinguishable at a glance, and that is data, not a design-system choice.
   */
  cardGradient: string;
  issuer: string;
  /** The Centrifuge share class this route reads and transacts against. */
  shareClass: {
    scId: `0x${string}`;
    symbol: ShareToken;
  };
  /** Networks the share class is deployed to, for the listing card. */
  networks: Array<'Ethereum'>;
  acceptedAssets: Array<DepositToken>;
};

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
    shareClass: { scId: CENTRIFUGE_CONFIG.scId, symbol: 'zMCA' },
    networks: ['Ethereum'],
    acceptedAssets: ['USDC']
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
