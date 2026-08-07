import { type ComponentType } from 'react';

import { type ShareClassKey } from '@zivoe/centrifuge-indexer';
import { type IconProps } from '@zivoe/ui/icons/types';

import { type ShareToken } from '@/types/constants';

/**
 * One Offering is one Centrifuge share class, exposed at /offerings/<slug>.
 *
 * Centrifuge's model is Pool > Share Class > Vault: a pool holds N share
 * classes (tranches, each with its own share token, price, AUM and yield
 * history), and a vault is one share class instantiated on one network for one
 * deposit asset. A route is therefore keyed by share class, not by vault — the
 * same class accepting a second stablecoin stays one Offering, which is also
 * why the URL says offerings rather than vaults.
 *
 * The contract is split along the Next serialization boundary: OfferingIdentity
 * is plain data safe to hand to a client provider; OfferingPresentation is
 * server-rendered and may hold components and rich content. Component and
 * function fields must never cross into the identity half.
 */
export type OfferingIdentity = {
  /** Permanent public URL segment — it ends up in emails and external links. */
  slug: string;
  name: string;
  /** The Centrifuge share class this route reads and transacts against. */
  shareClass: {
    /** Catalog key — the share-class dimension of caches, query keys and vault resolution. */
    key: ShareClassKey;
    symbol: ShareToken;
  };
};

export type OfferingPresentation = {
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
  /** Share-token subtitle for token display maps and pickers. */
  shareTokenDescription: string;
};

export type Offering = OfferingIdentity & OfferingPresentation;
