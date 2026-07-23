export const CENTRIFUGE_NETWORKS = ['mainnet', 'sepolia'] as const;

export type CentrifugeNetwork = (typeof CENTRIFUGE_NETWORKS)[number];

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

const CONFIGS: Record<CentrifugeNetwork, CentrifugeIndexerConfig & { deployable: boolean }> = {
  sepolia: {
    network: 'sepolia',
    chainId: 11155111,
    indexerUrl: 'https://api-v3-test.cfg.embrio.tech',
    shareTokenAddress: '0xc0cE8aFcb1D3299A3445575EA426c1b313298B4c',
    poolId: '281474976720680',
    scId: '0x00010000000027280000000000000001',
    deployable: true
  },
  mainnet: {
    // NON-DEPLOYABLE PLACEHOLDER: no mainnet deployment yet — zero values fail
    // loudly if the guard below is bypassed.
    network: 'mainnet',
    chainId: 1,
    indexerUrl: 'https://api.centrifuge.io',
    shareTokenAddress: '0x0000000000000000000000000000000000000000',
    poolId: '0',
    scId: '0x00000000000000000000000000000000',
    deployable: false
  }
};

export function getCentrifugeIndexerConfig(network: CentrifugeNetwork): CentrifugeIndexerConfig {
  const { deployable, ...config } = CONFIGS[network];

  if (!deployable)
    throw new Error(
      `Centrifuge indexer config for "${network}" is a non-deployable placeholder. Replace it with operator-verified values before deploying.`
    );

  return config;
}
