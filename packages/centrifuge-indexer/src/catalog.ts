import { CENTRIFUGE_NETWORKS, type CentrifugeNetwork } from './config';

/**
 * One share class's identity on one network it claims. `deployable: false`
 * marks a placeholder entry — the launch is staged but the values are not
 * operator-verified yet, so resolving it throws instead of serving zeros.
 */
export type ShareClassNetworkEntry = {
  /** The pool id — the indexer's pool entity id and per-pool filter key. */
  poolId: string;
  /** The share-class id — the indexer's token / token-snapshot entity id. */
  scId: `0x${string}`;
  shareTokenAddress: `0x${string}`;
  deployable: boolean;
};

export type ShareClassCatalogEntry = {
  symbol: string;
  decimals: number;
  /** Networks the share class is staged or live on — absent means not offered there. */
  networks: Partial<Record<CentrifugeNetwork, ShareClassNetworkEntry>>;
};

/**
 * Every Centrifuge share class Zivoe integrates, as pure serializable data —
 * the single source both apps derive share-class identity from. Adding a class
 * means adding an entry here (plus an Offering module in the dApp); reviews of
 * new entries must verify the values on-chain and that the pool is
 * USD-denominated. Flip `deployable` only once the indexer prices the class on
 * that network: the aggregated NAV read is fail-closed, so a live-but-unpriced
 * entry hides the whole-book number on every surface until it is indexed.
 */
export const SHARE_CLASS_CATALOG = {
  zsmb: {
    symbol: 'zSMB',
    decimals: 18,
    networks: {
      sepolia: {
        poolId: '281474976720680',
        scId: '0x00010000000027280000000000000001',
        shareTokenAddress: '0xc0cE8aFcb1D3299A3445575EA426c1b313298B4c',
        deployable: true
      },

      mainnet: {
        poolId: '281474976710674',
        scId: '0x00010000000000120000000000000001',
        shareTokenAddress: '0xCCE288D1F14A6290E7946b9786231AAb54bf1FEC',
        deployable: true
      }
    }
  },
  zalt: {
    symbol: 'zALT',
    decimals: 18,
    networks: {
      sepolia: {
        poolId: '281474976720680',
        scId: '0x00010000000027280000000000000002',
        shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
        deployable: true
      },

      mainnet: {
        poolId: '281474976710674',
        scId: '0x00010000000000120000000000000002',
        shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
        deployable: true
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
    networks: Partial<Record<CentrifugeNetwork, { scId: string; shareTokenAddress: string }>>;
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
 * EVERY network, staged or live — cutover is the expensive time to find a
 * duplicate.
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

    for (const [network, claimed] of Object.entries(entry.networks)) {
      // Query sites send the scId verbatim (the indexer matches ids exactly),
      // unlike addresses, which they lowercase — so it must be stored lowercase.
      if (claimed && claimed.scId !== claimed.scId.toLowerCase())
        throw new Error(`Share class "${key}" must store its scId lowercase on "${network}".`);
    }
  }

  for (const network of CENTRIFUGE_NETWORKS) {
    const onNetwork = entries.flatMap((entry) => {
      const claimed = entry.networks[network];
      return claimed ? [claimed] : [];
    });

    assertUnique({
      values: onNetwork.map((entry) => entry.scId.toLowerCase()).filter((scId) => !ZERO_HEX.test(scId)),
      message: (scId) => `Share-class id ${scId} is claimed by two catalog entries on "${network}".`
    });
    assertUnique({
      values: onNetwork
        .map((entry) => entry.shareTokenAddress.toLowerCase())
        .filter((address) => !ZERO_HEX.test(address)),
      message: (address) => `Share token ${address} is claimed by two share classes on "${network}".`
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

/** A share class's identity resolved for one network — serializable, no placeholder values. */
export type ShareClassIdentity = {
  key: ShareClassKey;
  symbol: ShareClassSymbol;
  decimals: number;
  poolId: string;
  scId: `0x${string}`;
  shareTokenAddress: `0x${string}`;
};

function isShareClassKey(key: string): key is ShareClassKey {
  // Object.hasOwn, not `in`: ids arrive as arbitrary strings, and a
  // prototype-chain key like "toString" must fail the guard, not pass it and
  // die dereferencing a function's `networks`.
  return Object.hasOwn(SHARE_CLASS_CATALOG, key);
}

/**
 * Resolves a share-class id to its identity on one network. Accepts the open
 * string domain — ids travel through caches and providers as plain strings —
 * and fails loudly for ids the catalog does not know.
 */
export function getShareClassIdentity({
  network,
  key
}: {
  network: CentrifugeNetwork;
  key: string;
}): ShareClassIdentity {
  if (!isShareClassKey(key)) throw new Error(`Share class "${key}" is not in the catalog.`);

  const entry = SHARE_CLASS_CATALOG[key];
  const onNetwork = entry.networks[network];

  if (!onNetwork) throw new Error(`Share class "${key}" is not offered on "${network}".`);

  if (!onNetwork.deployable)
    throw new Error(
      `Share class "${key}" on "${network}" is a non-deployable placeholder. Replace it with operator-verified values before deploying.`
    );

  return {
    key,
    symbol: entry.symbol,
    decimals: entry.decimals,
    poolId: onNetwork.poolId,
    scId: onNetwork.scId,
    shareTokenAddress: onNetwork.shareTokenAddress
  };
}

/** Structural view for the listing helpers — tests inject synthetic catalogs. */
type DeployableFlagsView = Record<string, { networks: Partial<Record<CentrifugeNetwork, { deployable: boolean }>> }>;

/**
 * Keys of the share classes live (deployable) on the network, in catalog
 * order. No caller needs the key union back — consumers count, re-resolve
 * through getShareClassIdentity, or pass the keys straight to queries.
 */
export function listShareClassKeys(
  network: CentrifugeNetwork,
  catalog: DeployableFlagsView = SHARE_CLASS_CATALOG
): Array<string> {
  return Object.keys(catalog).filter((key) => catalog[key]?.networks[network]?.deployable);
}

/** Networks the share class is live on — claimed entries with operator-verified values. */
export function getShareClassNetworks(
  key: string,
  catalog: DeployableFlagsView = SHARE_CLASS_CATALOG
): Array<CentrifugeNetwork> {
  // Same boundary rule as getShareClassIdentity: an unknown key fails loudly
  // instead of silently reading as "live on no network".
  if (!Object.hasOwn(catalog, key)) throw new Error(`Share class "${key}" is not in the catalog.`);

  const networks = catalog[key]?.networks ?? {};
  return (Object.keys(networks) as Array<CentrifugeNetwork>).filter((network) => networks[network]?.deployable);
}
