import { type Address } from 'viem';

type AccountProps = {
  accountAddress?: Address;
};

/**
 * Share-class dimension carried by every Centrifuge key, so no two classes
 * can share a cache entry. A plain string (not the catalog union) — the key
 * travels from resolved identity objects, and test fixtures are deliberately
 * unregistered.
 *
 * The catalog key rather than the on-chain scId, by choice: it is the same
 * handle Centrifuge-vault memoization, invalidations, and server cache arguments use,
 * the catalog pins it 1:1 to an scId per environment, and keys are
 * permanent once registered. Query caches are ephemeral besides — even a
 * rename would cost one cold fetch, not correctness.
 */
type ShareClassProps = {
  shareClassKey: string;
};

/**
 * Chain dimension of every chain-scoped key: wallet balances, Centrifuge-vault
 * state and positions differ per spoke chain even for one share class, and one
 * address can legitimately exist on two chains (deterministic deploys), so the
 * token address alone cannot split the cache. Appended AFTER the share-class
 * key so class-scoped invalidations keep prefix-matching every chain's entries.
 */
type ChainProps = {
  chain: string;
};

/**
 * Centrifuge-vault dimension of every vault-scoped key: one share class has
 * one Centrifuge vault per deposit asset on a chain, and capacity, previews
 * and Redemption Positions are facts of ONE vault. Appended AFTER the chain so
 * class- and chain-prefixed invalidations keep matching. Lowercased here so a
 * checksummed and a lowercase spelling of one vault cannot split the cache.
 */
type CentrifugeVaultProps = ChainProps & {
  centrifugeVaultAddress: string;
};

const account = {
  by: ({ accountAddress }: AccountProps) => ['ACCOUNT', accountAddress],
  balance: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'BALANCE'],
  balanceOf: ({ accountAddress, chain, id }: AccountProps & ChainProps & { id: Address }) => [
    ...account.balance({ accountAddress }),
    chain,
    id
  ],
  allowance: ({
    accountAddress,
    chain,
    contract,
    spender
  }: AccountProps & ChainProps & { contract: Address; spender: Address }) => [
    ...account.by({ accountAddress }),
    'ALLOWANCE',
    chain,
    contract,
    spender
  ],
  chainalysis: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'CHAINALYSIS'],
  portfolio: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'PORTFOLIO'],
  redemptionPositions: ({ accountAddress, shareClassKey }: AccountProps & ShareClassProps) => [
    ...account.by({ accountAddress }),
    'REDEMPTION_POSITION',
    shareClassKey
  ],
  redemptionPosition: ({
    accountAddress,
    shareClassKey,
    chain,
    centrifugeVaultAddress
  }: AccountProps & ShareClassProps & CentrifugeVaultProps) => [
    ...account.redemptionPositions({ accountAddress, shareClassKey }),
    chain,
    centrifugeVaultAddress.toLowerCase()
  ],
  investorAccess: ({ accountAddress, shareClassKey, chain }: AccountProps & ShareClassProps & ChainProps) => [
    ...account.by({ accountAddress }),
    'INVESTOR_ACCESS',
    shareClassKey,
    chain
  ]
};

const app = {
  emailPreferences: ({ token }: { token?: string }) => ['EMAIL_PREFERENCES', token ?? 'session'],
  centrifugeVaultCapacity: ({
    shareClassKey,
    chain,
    centrifugeVaultAddress
  }: ShareClassProps & CentrifugeVaultProps) => [
    'CENTRIFUGE',
    shareClassKey,
    'VAULT_CAPACITY',
    chain,
    centrifugeVaultAddress.toLowerCase()
  ],
  depositPreview: ({
    shareClassKey,
    chain,
    centrifugeVaultAddress,
    assets
  }: ShareClassProps & CentrifugeVaultProps & { assets: bigint }) => [
    'CENTRIFUGE',
    shareClassKey,
    'DEPOSIT_PREVIEW',
    chain,
    centrifugeVaultAddress.toLowerCase(),
    assets.toString()
  ],
  // Hub-level on purpose: Share Price / NAV / APY are identical across the
  // environment's chains, so a chain dimension would only split the cache.
  shareMetrics: ({ shareClassKey }: ShareClassProps) => ['CENTRIFUGE', shareClassKey, 'SHARE_METRICS']
};

export const queryKeys = {
  account,
  app
};
