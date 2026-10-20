import { type Address, type Hex } from 'viem';

// ---------------------------------------------------------------------------
// The signed message — EIP-712, one shape, built in one place. Pure: no
// `@/server`, no Node, so the client can type what it signs and the module
// can rebuild it from a stored row without trusting anything the client posts.
// ---------------------------------------------------------------------------

export const WALLET_LINK_STATEMENT =
  'I control this wallet and ask Zivoe to link it to my verified account. ' +
  'Zivoe may whitelist it for Zivoe vaults. This signature is free and moves no funds.';

export const WALLET_LINK_TYPES = {
  WalletLink: [
    { name: 'statement', type: 'string' },
    /** The user's email — what the signer recognises in the wallet prompt. */
    { name: 'account', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
    /** Unix seconds. */
    { name: 'issuedAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' }
  ]
} as const;

export type WalletLinkTypedData = {
  /** No `verifyingContract`: the chain id is the connected chain, so wallets that bind a signature to a chain are satisfied. */
  domain: { name: 'Zivoe Verification'; version: '1'; chainId: number };
  types: typeof WALLET_LINK_TYPES;
  primaryType: 'WalletLink';
  message: {
    statement: string;
    account: string;
    wallet: Address;
    nonce: Hex;
    /** Unix seconds — numbers, so the payload survives JSON (a server action response, the `typed_data` column). */
    issuedAt: number;
    expiresAt: number;
  };
};

export function buildWalletLinkTypedData({
  chainId,
  email,
  address,
  nonce,
  issuedAt,
  expiresAt
}: {
  chainId: number;
  email: string;
  address: Address;
  nonce: Hex;
  issuedAt: Date;
  expiresAt: Date;
}): WalletLinkTypedData {
  return {
    domain: { name: 'Zivoe Verification', version: '1', chainId },
    types: WALLET_LINK_TYPES,
    primaryType: 'WalletLink',
    message: {
      statement: WALLET_LINK_STATEMENT,
      account: email,
      wallet: address,
      nonce,
      issuedAt: Math.floor(issuedAt.getTime() / 1000),
      expiresAt: Math.floor(expiresAt.getTime() / 1000)
    }
  };
}

/** What a viem `signTypedData` / `verifyTypedData` call takes: the uint256 fields as bigints. */
export function toSignableTypedData(typedData: WalletLinkTypedData) {
  return {
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: {
      ...typedData.message,
      issuedAt: BigInt(typedData.message.issuedAt),
      expiresAt: BigInt(typedData.message.expiresAt)
    }
  } as const;
}
