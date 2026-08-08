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
