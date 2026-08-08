import { type ComponentType, type ReactNode } from 'react';

import { type Address } from 'viem';

import { type CentrifugeNetwork, type ShareClassKey } from '@zivoe/centrifuge-indexer';
import { type IconProps } from '@zivoe/ui/icons/types';

/**
 * The fixed Details row set, in render order — one list owns both the rows
 * and their order. Offerings stay comparable line by line because the labels
 * never vary per module; a new row is a deliberate addition here. Rows whose
 * fact the catalog already owns are DERIVED at render and cannot be authored
 * by a module (two sources for one fact would drift) — the typed record
 * below forces every module to fill exactly the authored rows.
 */
export const OFFERING_DETAIL_LABELS = [
  'Issuer',
  'Ticker',
  'Asset Type',
  'Geography',
  'Inception',
  'Entry/exit fees',
  'Redemptions',
  'Eligibility',
  'Accepted stablecoin',
  'Accepted chains'
] as const;

export type OfferingDetailLabel = (typeof OFFERING_DETAIL_LABELS)[number];

/** Rows derived from the catalog or the Offering's own fields at render — never authored in `details`. */
export type DerivedDetailLabel = 'Issuer' | 'Ticker' | 'Asset Type' | 'Accepted stablecoin' | 'Accepted chains';

export type AuthoredDetailLabel = Exclude<OfferingDetailLabel, DerivedDetailLabel>;

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
 * classes (tranches, each with its own share token, price, NAV and yield
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
/**
 * Subscription status. 'Closed' takes an Offering out of new deposits while
 * its redemptions stay open, so this is a behavioral fact the deposit flow
 * reads — not only the listing card's chip. Further statuses join the union
 * here.
 */
export type OfferingStatus = 'Open' | 'Closed';

export type OfferingIdentity = {
  /** Permanent public URL segment — it ends up in emails and external links. */
  slug: string;
  name: string;
  /**
   * Required, not optional: it gates the deposit action, and an Offering with
   * no declared status would leave "can this wallet still subscribe?"
   * ambiguous. Lives in the identity half because the client tree reads it.
   */
  status: OfferingStatus;
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
  /** Asset class — the "Asset Type" row on the listing card and in Details. */
  category: string;
  /** Link-preview blurb for the Offering page — the card shows no excerpt. */
  description: string;
  /** Decorative artwork shown in the listing card's banner. */
  cardArtworkSrc: string;
  issuer: string;
  /** Share-token subtitle for token display maps and pickers. */
  shareTokenDescription: string;
  /** Published Target APY, in percent — authored data until the trailing-yield read returns. */
  targetApyPercent: number;
  /** About-section paragraphs, in render order — rich text with links allowed. */
  about: Array<ReactNode>;
  /** Details values for the AUTHORED rows only — a missing row fails to compile, a derived row cannot be written. */
  details: Record<AuthoredDetailLabel, string>;
  /** Documents-section links, in render order. */
  documents: Array<{ title: string; href: string }>;
};

export type Offering = OfferingIdentity & OfferingPresentation;
