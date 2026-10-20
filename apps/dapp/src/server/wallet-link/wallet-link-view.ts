import { type Address } from 'viem';

import { type WalletLinkRecord } from './wallet-link';

// The read model the page hands the client: what the Wallets step shows of
// one of the account's own requests, nothing a signature or an audit needs.
// Kept apart from the module, which imports `randomBytes`, so the client tree
// can type its props without reaching Node.

export type LinkedAddress = {
  id: string;
  /** Lowercase. */
  address: Address;
  signedAt: Date;
  /**
   * Whether the reconcile ever saw the address whitelisted everywhere. Not
   * the whitelist — the badge reads the chain live — but what tells "ops has
   * not got to it yet" from "it was whitelisted and no longer is".
   */
  wasWhitelisted: boolean;
};

export function toLinkedAddress(record: WalletLinkRecord): LinkedAddress {
  return {
    id: record.id,
    address: record.address,
    // A linked row always carries its signature time; the fallback only types the field.
    signedAt: record.signedAt ?? record.issuedAt,
    wasWhitelisted: record.whitelistObservedAt !== null
  };
}
