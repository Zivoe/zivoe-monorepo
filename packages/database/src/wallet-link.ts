/**
 * The lifecycle of a Wallet link. `pending` is a challenge issued and not yet
 * signed; `linked` is a verified Ownership proof that makes the account the
 * address's owner for good — one `linked` row per address, ever, and nothing
 * moves a row out of `linked` (a trigger refuses it).
 */
export const walletLinkStatusValues = ['pending', 'linked'] as const;
export type WalletLinkStatus = (typeof walletLinkStatusValues)[number];

/**
 * What the app last asked ops to do with a Linked address: whitelist it (a
 * yes Decision) or revoke it (anything else — a revoke is a freeze on
 * Centrifuge). The owner's Decision decides which one is wanted; this is the
 * memory of what was already asked, so each change is asked once.
 */
export const walletLinkOpsRequestValues = ['whitelist', 'revoke'] as const;
export type WalletLinkOpsRequest = (typeof walletLinkOpsRequestValues)[number];

/**
 * The partial unique index behind "one owner per address". Named here so the
 * schema that creates it and the store that recognises its violation cannot
 * drift apart.
 */
export const WALLET_LINK_LINKED_ADDRESS_INDEX = 'wallet_link_linked_address_uidx';
