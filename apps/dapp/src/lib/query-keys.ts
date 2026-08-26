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
  redemptionPosition: ({ accountAddress, shareClassKey, chain }: AccountProps & ShareClassProps & ChainProps) => [
    ...account.redemptionPositions({ accountAddress, shareClassKey }),
    chain
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
  centrifugeVaultCapacity: ({ shareClassKey, chain }: ShareClassProps & ChainProps) => [
    'CENTRIFUGE',
    shareClassKey,
    'VAULT_CAPACITY',
    chain
  ],
  depositPreview: ({ shareClassKey, chain, assets }: ShareClassProps & ChainProps & { assets: bigint }) => [
    'CENTRIFUGE',
    shareClassKey,
    'DEPOSIT_PREVIEW',
    chain,
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
