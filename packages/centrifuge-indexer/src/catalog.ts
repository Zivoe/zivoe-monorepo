import {
  CENTRIFUGE_CHAINS,
  CENTRIFUGE_CHAIN_FACTS,
  CENTRIFUGE_ENVIRONMENTS,
  type CentrifugeChain,
  type CentrifugeEnvironment
} from './config';

/**
 * One share class's instance on one spoke chain it claims. `deployable: false`
 * marks a placeholder entry — the launch is staged but the values are not
 * operator-verified yet, so resolving it throws instead of serving zeros.
 */
export type ShareClassChainEntry = {
  shareTokenAddress: `0x${string}`;
  deployable: boolean;
};

/**
 * One share class's presence in one environment. Pool id and share-class id
 * are hub-level facts — identical on every spoke chain of the environment —
 * which is why they live here and not per chain.
 */
export type ShareClassEnvironmentEntry = {
  /** The pool id — the indexer's pool entity id and per-pool filter key. */
  poolId: string;
  /** The share-class id — the indexer's token / token-snapshot entity id. */
  scId: `0x${string}`;
  /** Spoke chains the share class is staged or live on — absent means not available there. */
  chains: Partial<Record<CentrifugeChain, ShareClassChainEntry>>;
};

export type ShareClassCatalogEntry = {
  symbol: string;
  decimals: number;
  /** Environments the share class is staged or live on — absent means not available there. */
  environments: Partial<Record<CentrifugeEnvironment, ShareClassEnvironmentEntry>>;
};

/**
 * Every Centrifuge share class Zivoe integrates, as pure serializable data —
 * the single source both apps derive share-class identity from. Adding a class
 * means adding an entry here (plus a Zivoe Vault module in the dApp); reviews of
 * new entries must verify the values on-chain and that the pool is
 * USD-denominated. Flip a chain's `deployable` only once the Centrifuge vault is deployed
 * AND the indexer prices the class on that chain: the aggregated NAV read is
 * fail-closed, so a live-but-unpriced entry hides the whole-book number on
 * every surface until it is indexed.
 */
export const SHARE_CLASS_CATALOG = {
  zsmb: {
    symbol: 'zSMB',
    decimals: 18,
    environments: {
      testnet: {
        poolId: '281474976720680',
        scId: '0x00010000000027280000000000000002',
        chains: {
          sepolia: {
            shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
            deployable: true
          },
          'base-sepolia': {
            shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
            deployable: true
          }
        }
      },

      mainnet: {
        poolId: '281474976710674',
        scId: '0x00010000000000120000000000000002',
        chains: {
          ethereum: {
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            deployable: true
          },
          pharos: {
            shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
            deployable: true
          }
        }
      }
    }
  }
} as const satisfies Record<string, ShareClassCatalogEntry>;

/** Structural view of the catalog for the invariant sweep — tests inject synthetic catalogs. */
type CatalogLike = Record<
  string,
  {
    symbol: string;
    decimals: number;
    environments: Partial<
      Record<
        CentrifugeEnvironment,
        {
          scId: string;
          chains: Partial<Record<CentrifugeChain, { shareTokenAddress: string; deployable: boolean }>>;
        }
      >
    >;
  }
>;

/** Matches placeholder zero hex values (addresses, scIds) in staged entries. */
export const ZERO_HEX = /^0x0+$/i;

/**
 * Import-time invariants over the catalog itself, checked wherever the catalog
 * is imported — both apps, so a landing-only build is guarded too. Two entries
 * sharing an on-chain identity would serve one share class's data under the
 * other's name (and the aggregated nav read would double-count the class);
 * two sharing a symbol would collide in every token display map. Placeholder
 * zeros are excluded: staged launches legitimately share them. Swept across
 * EVERY environment and chain, staged or live — cutover is the expensive time
 * to find a duplicate.
 */
export function assertShareClassCatalogInvariants(catalog: CatalogLike = SHARE_CLASS_CATALOG): void {
  const entries = Object.values(catalog);

  // Lowercased: two symbols differing only in case would read as one share class
  // to a user while keying two display-map entries.
  assertUnique({
    values: entries.map((entry) => entry.symbol.toLowerCase()),
    message: (symbol) => `Share token symbol "${symbol}" is claimed by two share classes.`
  });

  for (const [key, entry] of Object.entries(catalog)) {
    // Decimals scale every parseUnits and NAV division, and are the one money
    // field whose only other guard (the chain assertion at Centrifuge-vault resolution)
    // fires after the UI and server have already formatted with the value.
    // 36 is comfortably past any real ERC-20; beyond it is a typo, not a token.
    if (!Number.isInteger(entry.decimals) || entry.decimals < 0 || entry.decimals > 36)
      throw new Error(`Share class "${key}" declares implausible decimals: ${String(entry.decimals)}.`);

    for (const [environment, onEnvironment] of Object.entries(entry.environments)) {
      // Query sites send the scId verbatim (the indexer matches ids exactly),
      // unlike addresses, which they lowercase — so it must be stored lowercase.
      if (onEnvironment.scId !== onEnvironment.scId.toLowerCase())
        throw new Error(`Share class "${key}" must store its scId lowercase on "${environment}".`);

      for (const [chain, claimed] of Object.entries(onEnvironment.chains) as Array<
        [CentrifugeChain, { shareTokenAddress: string; deployable: boolean }]
      >) {
        // A chain filed under the wrong environment would resolve against the
        // wrong hub's pool ids and indexer.
        if (CENTRIFUGE_CHAIN_FACTS[chain].environment !== environment)
          throw new Error(
            `Share class "${key}" claims chain "${chain}" under "${environment}", but the chain belongs to "${CENTRIFUGE_CHAIN_FACTS[chain].environment}".`
          );

        // deployable asserts operator-verified values — a zero address under
        // that flag is a flipped flag, not a staged launch.
        if (claimed.deployable && ZERO_HEX.test(claimed.shareTokenAddress))
          throw new Error(
            `Share class "${key}" on "${chain}" is deployable but carries a placeholder share token address.`
          );
      }
    }
  }

  for (const environment of CENTRIFUGE_ENVIRONMENTS) {
    // scIds are hub-level, so uniqueness is per environment...
    assertUnique({
      values: entries.flatMap((entry) => {
        const scId = entry.environments[environment]?.scId.toLowerCase();
        return scId && !ZERO_HEX.test(scId) ? [scId] : [];
      }),
      message: (scId) => `Share-class id ${scId} is claimed by two catalog entries on "${environment}".`
    });
  }

  for (const chain of CENTRIFUGE_CHAINS) {
    // ...while token instances are per-chain, so address uniqueness is per
    // chain (the same address on two chains is legitimate under deterministic
    // deployment, and must not false-positive here).
    const environment = CENTRIFUGE_CHAIN_FACTS[chain].environment;
    assertUnique({
      values: entries.flatMap((entry) => {
        const address = entry.environments[environment]?.chains[chain]?.shareTokenAddress.toLowerCase();
        return address && !ZERO_HEX.test(address) ? [address] : [];
      }),
      message: (address) => `Share token ${address} is claimed by two share classes on "${chain}".`
    });
  }
}

/** Throws via `message` on the first duplicate — shared by both invariant sweeps (catalog here, registry in the dApp). */
export function assertUnique({ values, message }: { values: Array<string>; message: (duplicate: string) => string }) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) throw new Error(message(value));
    seen.add(value);
  }
}

assertShareClassCatalogInvariants();

export type ShareClassKey = keyof typeof SHARE_CLASS_CATALOG;

/** Union of every catalogued share token symbol — derive token unions from this, never hand-extend them. */
export type ShareClassSymbol = (typeof SHARE_CLASS_CATALOG)[ShareClassKey]['symbol'];

/**
 * A share class's hub-level identity resolved for one environment —
 * serializable, no placeholder values. Everything here is identical across
 * the environment's spoke chains; chain-scoped facts live on
 * ShareClassChainIdentity.
 */
export type ShareClassIdentity = {
  key: ShareClassKey;
  symbol: ShareClassSymbol;
  decimals: number;
  poolId: string;
  scId: `0x${string}`;
};

/** The hub identity joined with the share class's instance on one spoke chain. */
export type ShareClassChainIdentity = ShareClassIdentity & {
  chain: CentrifugeChain;
  chainId: number;
  shareTokenAddress: `0x${string}`;
};

function isShareClassKey(key: string): key is ShareClassKey {
  // Object.hasOwn, not `in`: ids arrive as arbitrary strings, and a
  // prototype-chain key like "toString" must fail the guard, not pass it and
  // die dereferencing a function's `environments`.
  return Object.hasOwn(SHARE_CLASS_CATALOG, key);
}

/**
 * Resolves a share-class id to its hub-level identity on one environment.
 * Accepts the open string domain — ids travel through caches and providers as
 * plain strings — and fails loudly for ids the catalog does not know or that
 * are not live (deployable on at least one chain) in the environment.
 */
export function getShareClassIdentity({
  environment,
  key
}: {
  environment: CentrifugeEnvironment;
  key: string;
}): ShareClassIdentity {
  if (!isShareClassKey(key)) throw new Error(`Share class "${key}" is not in the catalog.`);

  const entry = SHARE_CLASS_CATALOG[key];
  const onEnvironment = entry.environments[environment];

  if (!onEnvironment) throw new Error(`Share class "${key}" is not available on "${environment}".`);

  if (!Object.values(onEnvironment.chains).some((chain) => chain.deployable))
    throw new Error(`Share class "${key}" is not live on any "${environment}" chain.`);

  return {
    key,
    symbol: entry.symbol,
    decimals: entry.decimals,
    poolId: onEnvironment.poolId,
    scId: onEnvironment.scId
  };
}

/**
 * Resolves a share-class id to its identity on one spoke chain (the chain
 * implies the environment). Fails loudly for ids the catalog does not know,
 * chains the class is not available on, and staged placeholders.
 */
export function getShareClassChainIdentity({
  chain,
  key
}: {
  chain: CentrifugeChain;
  key: string;
}): ShareClassChainIdentity {
  const { environment, chainId } = CENTRIFUGE_CHAIN_FACTS[chain];

  // The hub half delegates — one trust boundary and one assembly, so a hub
  // field added to ShareClassIdentity cannot be forgotten here.
  const identity = getShareClassIdentity({ environment, key });

  // Viewed structurally at the lookup only: the as-const catalog narrows each
  // entry's chain record to its literal keys, which the open CentrifugeChain
  // index cannot address — while the delegate above already resolved the
  // narrow entry, so `symbol` keeps its union type.
  const onChain = (SHARE_CLASS_CATALOG[identity.key] as ShareClassCatalogEntry).environments[environment]?.chains[
    chain
  ];

  if (!onChain) throw new Error(`Share class "${key}" is not available on "${chain}".`);

  if (!onChain.deployable)
    throw new Error(
      `Share class "${key}" on "${chain}" is a non-deployable placeholder. Replace it with operator-verified values before deploying.`
    );

  return { ...identity, chain, chainId, shareTokenAddress: onChain.shareTokenAddress };
}

/** Structural view for the listing helpers — tests inject synthetic catalogs. */
type DeployableFlagsView = Record<
  string,
  {
    environments: Partial<
      Record<CentrifugeEnvironment, { chains: Partial<Record<CentrifugeChain, { deployable: boolean }>> }>
    >;
  }
>;

/**
 * Keys of the share classes live (deployable on at least one chain) in the
 * environment, in catalog order. No caller needs the key union back —
 * consumers count, re-resolve through the identity helpers, or pass the keys
 * straight to queries.
 */
export function listShareClassKeys(
  environment: CentrifugeEnvironment,
  catalog: DeployableFlagsView = SHARE_CLASS_CATALOG
): Array<string> {
  return Object.keys(catalog).filter((key) => {
    const chains = catalog[key]?.environments[environment]?.chains ?? {};
    return Object.values(chains).some((chain) => chain.deployable);
  });
}
