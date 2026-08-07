import { getShareClassIdentity } from './catalog';

export const CENTRIFUGE_NETWORKS = ['mainnet', 'sepolia'] as const;

export type CentrifugeNetwork = (typeof CENTRIFUGE_NETWORKS)[number];

/** Facts of the network itself, shared by every share class living on it. */
export type CentrifugeNetworkFacts = {
  chainId: number;
  indexerUrl: string;
};

export const CENTRIFUGE_NETWORK_FACTS: Record<CentrifugeNetwork, CentrifugeNetworkFacts> = {
  sepolia: { chainId: 11155111, indexerUrl: 'https://api-v3-test.cfg.embrio.tech' },
  mainnet: { chainId: 1, indexerUrl: 'https://api.centrifuge.io' }
};

export type CentrifugeIndexerConfig = {
  network: CentrifugeNetwork;
  chainId: number;
  indexerUrl: string;
  shareTokenAddress: `0x${string}`;
  /** The pool id — the indexer's pool entity id and per-pool filter key. */
  poolId: string;
  /** The share-class id — the indexer's token / token-snapshot entity id. */
  scId: `0x${string}`;
};

/**
 * The legacy single-share-class config: network facts plus the zMCA catalog
 * entry. Kept as a thin composition over the catalog so existing consumers
 * stay green while they migrate to per-share-class identity.
 */
export function getCentrifugeIndexerConfig(network: CentrifugeNetwork): CentrifugeIndexerConfig {
  const identity = getShareClassIdentity({ network, key: 'zmca' });

  return {
    network,
    ...CENTRIFUGE_NETWORK_FACTS[network],
    shareTokenAddress: identity.shareTokenAddress,
    poolId: identity.poolId,
    scId: identity.scId
  };
}
