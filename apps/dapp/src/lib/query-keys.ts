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
 * the registry invariants pin it 1:1 to an scId per network, and keys are
 * permanent once registered. Query caches are ephemeral besides — even a
 * rename would cost one cold fetch, not correctness.
 */
type ShareClassProps = {
  shareClassKey: string;
};

/**
 * Vault dimension for the keys whose read one Centrifuge vault answers, rather
 * than the share class as a whole. A class carries one Centrifuge vault per network today
 * and would carry several the day it accepts a second deposit asset — and every
 * key below resolves through `centrifugeVault.investment`/`centrifugeVault.details` or reads the
 * Centrifuge-vault address directly, so the address is what makes two answers differ.
 * Keyed by class AND address for the same reason `getCentrifugeVault` memoizes by both.
 * Lowercased because the address arrives from configuration and could differ
 * from a resolved one in checksum casing alone.
 */
type CentrifugeVaultProps = ShareClassProps & {
  centrifugeVaultAddress: Address;
};

const centrifugeVaultScope = ({ shareClassKey, centrifugeVaultAddress }: CentrifugeVaultProps) => [
  shareClassKey,
  centrifugeVaultAddress.toLowerCase()
];

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
  redemptionPosition: ({ accountAddress, ...vault }: AccountProps & CentrifugeVaultProps) => [
    ...account.by({ accountAddress }),
    'REDEMPTION_POSITION',
    ...centrifugeVaultScope(vault)
  ],
  investorWhitelist: ({ accountAddress, ...vault }: AccountProps & CentrifugeVaultProps) => [
    ...account.by({ accountAddress }),
    'INVESTOR_WHITELIST',
    ...centrifugeVaultScope(vault)
  ]
};

const app = {
  emailPreferences: ({ token }: { token?: string }) => ['EMAIL_PREFERENCES', token ?? 'session'],
  centrifugeVaultCapacity: (vault: CentrifugeVaultProps) => [
    'CENTRIFUGE',
    ...centrifugeVaultScope(vault),
    'VAULT_CAPACITY'
  ],
  depositPreview: ({ assets, ...vault }: CentrifugeVaultProps & { assets: bigint }) => [
    'CENTRIFUGE',
    ...centrifugeVaultScope(vault),
    'DEPOSIT_PREVIEW',
    assets.toString()
  ],
  // Class-scoped on purpose: NAV and Token Price are facts about the share
  // class, and the indexer answers them without a Centrifuge vault.
  shareMetrics: ({ shareClassKey }: ShareClassProps) => ['CENTRIFUGE', shareClassKey, 'SHARE_METRICS']
};

export const queryKeys = {
  account,
  app
};
