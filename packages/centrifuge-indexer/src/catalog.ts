import { type CentrifugeNetwork } from './config';

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
 * USD-denominated.
 */
export const SHARE_CLASS_CATALOG = {
  zmca: {
    symbol: 'zMCA',
    decimals: 18,
    networks: {
      sepolia: {
        poolId: '281474976720680',
        scId: '0x00010000000027280000000000000001',
        shareTokenAddress: '0xc0cE8aFcb1D3299A3445575EA426c1b313298B4c',
        deployable: true
      },
      mainnet: {
        // NON-DEPLOYABLE PLACEHOLDER: no mainnet deployment yet — zero values
        // fail loudly if the resolution guard is bypassed.
        poolId: '0',
        scId: '0x00000000000000000000000000000000',
        shareTokenAddress: '0x0000000000000000000000000000000000000000',
        deployable: false
      }
    }
  }
} as const satisfies Record<string, ShareClassCatalogEntry>;

export type ShareClassKey = keyof typeof SHARE_CLASS_CATALOG;

/** Union of every catalogued share token symbol — derive token unions from this, never hand-extend them. */
export type ShareClassSymbol = (typeof SHARE_CLASS_CATALOG)[ShareClassKey]['symbol'];

export const SHARE_CLASS_KEYS = Object.keys(SHARE_CLASS_CATALOG) as Array<ShareClassKey>;

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
  return key in SHARE_CLASS_CATALOG;
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

/** Keys of the share classes live (deployable) on the network, in catalog order. */
export function listShareClassKeys(network: CentrifugeNetwork): Array<ShareClassKey> {
  return SHARE_CLASS_KEYS.filter((key) => SHARE_CLASS_CATALOG[key].networks[network]?.deployable);
}

/** Networks the share class is live on — claimed entries with operator-verified values. */
export function getShareClassNetworks(key: ShareClassKey): Array<CentrifugeNetwork> {
  const networks = SHARE_CLASS_CATALOG[key].networks;
  return (Object.keys(networks) as Array<CentrifugeNetwork>).filter((network) => networks[network]?.deployable);
}
