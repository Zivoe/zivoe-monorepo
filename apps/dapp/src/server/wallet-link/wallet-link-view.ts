import { type Address } from 'viem';

import { type WalletLinkOpsRequest } from '@zivoe/database/wallet-link';

import { type WalletLinkRecord } from './wallet-link';

// The read model the page hands the client: what the Wallets step shows of
// one of the account's own Linked addresses, nothing a signature or an audit
// needs. Kept apart from the module, which imports `randomBytes`, so the
// client tree can type its props without reaching Node.

export type LinkedAddress = {
  id: string;
  /** Lowercase. */
  address: Address;
  signedAt: Date;
  /** What ops was last asked: whitelist on a yes, revoke (a freeze) otherwise. The link itself never ends. */
  opsRequest: WalletLinkOpsRequest;
  /** When the latest Whitelist request was made: the link, or the approval again that restores it. */
  whitelistRequestedAt: Date;
  /** The latest Whitelist request restores a revoked address — no new signature — rather than admitting a new one. */
  isRestore: boolean;
  /**
   * Whether the reconcile saw the address whitelisted everywhere since the
   * latest Whitelist request. Not the whitelist — the badge reads the chain
   * live — but what tells "ops has not got to it yet" from "it was
   * whitelisted and no longer is".
   */
  wasWhitelisted: boolean;
};

export function toLinkedAddress(record: WalletLinkRecord): LinkedAddress {
  // A linked row always carries its signature time and an ops request (the
  // database checks both); the fallbacks only type the fields.
  const signedAt = record.signedAt ?? record.issuedAt;
  return {
    id: record.id,
    address: record.address,
    signedAt,
    opsRequest: record.opsRequest ?? 'whitelist',
    whitelistRequestedAt: record.whitelistRequestedAt ?? signedAt,
    isRestore: record.opsRequestVersion > 1,
    wasWhitelisted: record.whitelistObservedAt !== null
  };
}
