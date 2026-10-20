/**
 * The lifecycle of a Wallet link — one account's signed request to whitelist
 * one address. `pending` is a challenge issued and not yet signed; `linked`
 * is a signed, verified request; `removed` is one the reconcile ended because
 * the investor's Decision became a no. An address is not bound to one
 * account: several may each hold a `linked` row for it.
 */
export const walletLinkStatusValues = ['pending', 'linked', 'removed'] as const;
export type WalletLinkStatus = (typeof walletLinkStatusValues)[number];

/**
 * The partial unique index behind "one live request per account and
 * address". Named here so the schema that creates it and the store that
 * recognises its violation cannot drift apart.
 */
export const WALLET_LINK_LINKED_USER_ADDRESS_INDEX = 'wallet_link_linked_user_address_uidx';
