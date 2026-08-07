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
 * handle vault memoization, invalidations, and server cache arguments use,
 * the registry invariants pin it 1:1 to an scId per network, and keys are
 * permanent once registered. Query caches are ephemeral besides — even a
 * rename would cost one cold fetch, not correctness.
 */
type ShareClassProps = {
  shareClassKey: string;
};

const account = {
  by: ({ accountAddress }: AccountProps) => ['ACCOUNT', accountAddress],
  balance: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'BALANCE'],
  balanceOf: ({ accountAddress, id }: AccountProps & { id: Address }) => [...account.balance({ accountAddress }), id],
  allowance: ({ accountAddress, contract, spender }: AccountProps & { contract: Address; spender: Address }) => [
    ...account.by({ accountAddress }),
    'ALLOWANCE',
    contract,
    spender
  ],
  chainalysis: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'CHAINALYSIS'],
  portfolio: ({ accountAddress }: AccountProps) => [...account.by({ accountAddress }), 'PORTFOLIO'],
  redemptionPosition: ({ accountAddress, shareClassKey }: AccountProps & ShareClassProps) => [
    ...account.by({ accountAddress }),
    'REDEMPTION_POSITION',
    shareClassKey
  ],
  investorAllowlist: ({ accountAddress, shareClassKey }: AccountProps & ShareClassProps) => [
    ...account.by({ accountAddress }),
    'INVESTOR_ALLOWLIST',
    shareClassKey
  ]
};

const app = {
  emailPreferences: ({ token }: { token?: string }) => ['EMAIL_PREFERENCES', token ?? 'session'],
  vaultCapacity: ({ shareClassKey }: ShareClassProps) => ['CENTRIFUGE', shareClassKey, 'VAULT_CAPACITY'],
  depositPreview: ({ shareClassKey, assets }: ShareClassProps & { assets: bigint }) => [
    'CENTRIFUGE',
    shareClassKey,
    'DEPOSIT_PREVIEW',
    assets.toString()
  ],
  shareMetrics: ({ shareClassKey }: ShareClassProps) => ['CENTRIFUGE', shareClassKey, 'SHARE_METRICS']
};

export const queryKeys = {
  account,
  app
};
