import { type ComponentType } from 'react';

import { ZMcaLogo } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { type ShareToken } from '@/types/constants';

import { CENTRIFUGE_CONFIG } from '@/centrifuge';

/**
 * One Opportunity is one Centrifuge share class, exposed at /opportunities/<slug>.
 *
 * Centrifuge's model is Pool > Share Class > Vault: a pool holds N share
 * classes (tranches, each with its own share token, price, NAV and yield
 * history), and a vault is one share class instantiated on one network for one
 * deposit asset. A route is therefore keyed by share class, not by vault — the
 * same class accepting a second stablecoin stays one Opportunity, which is also
 * why the URL says opportunities rather than vaults.
 */
export type Opportunity = {
  /** Permanent public URL segment — it ends up in emails and external links. */
  slug: string;
  name: string;
  Logo: ComponentType<IconProps>;
  /** The Centrifuge share class this route reads and transacts against. */
  shareClass: {
    scId: `0x${string}`;
    symbol: ShareToken;
  };
};

export const OPPORTUNITIES: Array<Opportunity> = [
  {
    slug: 'global-mca-opportunities',
    name: 'Global MCA Opportunities Fund',
    Logo: ZMcaLogo,
    shareClass: { scId: CENTRIFUGE_CONFIG.scId, symbol: 'zMCA' }
  }
];

// Share-class identity is still a module-level singleton below the route
// (CENTRIFUGE_CONFIG, the memoized vault, and the unparameterized query and
// unstable_cache keys). Until that is threaded per share class, a second entry
// here would silently serve the first entry's charts, stats and vault under
// its own URL — so fail at import time instead.
if (OPPORTUNITIES.length > 1)
  throw new Error(
    'The Centrifuge data layer is still single-share-class. Parameterize CENTRIFUGE_CONFIG, the vault client, the query keys and the unstable_cache keys by share class before registering a second Opportunity.'
  );

export function getOpportunity(slug: string): Opportunity | undefined {
  return OPPORTUNITIES.find((opportunity) => opportunity.slug === slug);
}

export const OPPORTUNITY_PATH_PREFIX = '/opportunities';

export function opportunityPath(opportunity: Pick<Opportunity, 'slug'>): string {
  return `${OPPORTUNITY_PATH_PREFIX}/${opportunity.slug}`;
}

export function isOpportunityPath(pathname: string): boolean {
  return pathname.startsWith(`${OPPORTUNITY_PATH_PREFIX}/`);
}
