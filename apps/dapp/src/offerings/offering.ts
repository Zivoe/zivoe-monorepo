import { type ComponentType, type ReactNode } from 'react';

import { type Address } from 'viem';

import { type CentrifugeNetwork, type ShareClassKey } from '@zivoe/centrifuge-indexer';
import { type IconProps } from '@zivoe/ui/icons/types';

/**
 * The fixed Details row set every Offering must fill, in render order.
 * Offerings stay comparable line by line because the labels never vary per
 * module; a new row is a deliberate addition here, forced onto every module
 * by the typed record below. Facts the catalog already owns (the Available
 * Networks row) are derived at render, never authored here — two sources for
 * one fact would drift.
 */
export const OFFERING_DETAIL_LABELS = [
  'Eligibility',
  'Underlying Assets',
  'Geography',
  'Legal Structure',
  'Regulatory Compliance',
  'Management Fee',
  'Liquidity',
  'Audits'
] as const;

export type OfferingDetailLabel = (typeof OFFERING_DETAIL_LABELS)[number];

/** A Details row value: plain text, or an external link the section styles itself. */
export type OfferingDetailValue = string | { href: string; label: string };

/** The vault instantiating the share class for USDC on one network. */
export type OfferingVault = {
  address: Address;
  /**
   * False while the address is a placeholder for a network the launch is
   * staged on — resolving it throws rather than decoding receipts against
   * the zero address (which silently matches nothing).
   */
  deployable: boolean;
};

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
    /**
     * Catalog key — the share-class dimension of caches, query keys and vault
     * resolution. Symbol, decimals and on-chain ids are always read off the
     * catalog by this key, never re-declared here, so a module cannot drift
     * from the class it references.
     */
    key: ShareClassKey;
  };
  /**
   * dApp-only identity: the vault per network this Offering claims —
   * collocated here so a launch is a catalog entry plus this one module,
   * with no third map to keep in sync. The registry invariants force the
   * claimed networks to match the catalog's, both ways.
   */
  vaults: Partial<Record<CentrifugeNetwork, OfferingVault>>;
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
  /** Published Target APY, in percent — authored data until the trailing-yield read returns. */
  targetApyPercent: number;
  /** About-section paragraphs, in render order — rich text with links allowed. */
  about: Array<ReactNode>;
  /** Details values for the fixed row set — a missing row fails to compile. */
  details: Record<OfferingDetailLabel, OfferingDetailValue>;
  /** Documents-section links, in render order. */
  documents: Array<{ title: string; href: string }>;
};

export type Offering = OfferingIdentity & OfferingPresentation;
