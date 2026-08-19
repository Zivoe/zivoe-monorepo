/**
 * The two axes of a Centrifuge deployment, split on purpose:
 *
 * - An ENVIRONMENT is a whole protocol universe — one hub, one SDK
 *   environment flag, one indexer covering every chain in it. A deployment
 *   lives in exactly one environment (testnet for testing, mainnet for
 *   production).
 * - A CHAIN is one spoke network inside an environment, where share-class
 *   token instances and Centrifuge vaults are actually deployed. A deployment
 *   activates an ordered subset of its environment's chains.
 *
 * Hub-level facts (pool ids, share-class ids, prices, NAV) are identical
 * across every chain of an environment; token and Centrifuge-vault addresses
 * and wallet state are per-chain.
 */
export const CENTRIFUGE_ENVIRONMENTS = ['mainnet', 'testnet'] as const;

export type CentrifugeEnvironment = (typeof CENTRIFUGE_ENVIRONMENTS)[number];

// Order is PRODUCT order, not alphabetical: each environment's first chain is
// its deployment's default (DEFAULT_CHAIN, analytics fallback) and drives the
// chain selectors' ordering — insert new chains behind the ones they should
// not displace.
export const CENTRIFUGE_CHAINS = ['ethereum', 'monad', 'sepolia', 'base-sepolia'] as const;

export type CentrifugeChain = (typeof CENTRIFUGE_CHAINS)[number];

/** Facts of the chain itself, shared by every share class living on it. */
export type CentrifugeChainFacts = {
  chainId: number;
  environment: CentrifugeEnvironment;
};

export const CENTRIFUGE_CHAIN_FACTS: Record<CentrifugeChain, CentrifugeChainFacts> = {
  ethereum: { chainId: 1, environment: 'mainnet' },
  monad: { chainId: 143, environment: 'mainnet' },
  sepolia: { chainId: 11155111, environment: 'testnet' },
  'base-sepolia': { chainId: 84532, environment: 'testnet' }
};

/** Facts of the environment itself — one indexer serves every chain in it. */
export type CentrifugeEnvironmentFacts = {
  indexerUrl: string;
};

export const CENTRIFUGE_ENVIRONMENT_FACTS: Record<CentrifugeEnvironment, CentrifugeEnvironmentFacts> = {
  mainnet: { indexerUrl: 'https://api.centrifuge.io' },
  testnet: { indexerUrl: 'https://api-v3-test.cfg.embrio.tech' }
};

/** The environment's chains in canonical (CENTRIFUGE_CHAINS) order. */
export function chainsOfEnvironment(environment: CentrifugeEnvironment): Array<CentrifugeChain> {
  return CENTRIFUGE_CHAINS.filter((chain) => CENTRIFUGE_CHAIN_FACTS[chain].environment === environment);
}
