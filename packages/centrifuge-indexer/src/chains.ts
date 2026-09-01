import { type Address, type Chain, defineChain } from 'viem';
import { arbitrum, base, baseSepolia, mainnet, sepolia } from 'viem/chains';

/**
 * The two axes of a Centrifuge deployment, split on purpose:
 *
 * - An ENVIRONMENT is a whole protocol universe — one hub, one SDK
 *   environment flag, one indexer covering every chain in it. A deployment
 *   lives in exactly one environment (testnet for testing, mainnet for
 *   production).
 * - A CHAIN is one spoke network inside an environment, where share-class
 *   token instances and Centrifuge vaults are actually deployed. A deployment
 *   activates every chain of its environment.
 *
 * Hub-level facts (pool ids, share-class ids, prices, NAV) are identical
 * across every chain of an environment; token and Centrifuge-vault addresses
 * and wallet state are per-chain.
 */
export const CENTRIFUGE_ENVIRONMENTS = ['mainnet', 'testnet'] as const;

export type CentrifugeEnvironment = (typeof CENTRIFUGE_ENVIRONMENTS)[number];

/** Facts of the environment itself — one indexer serves every chain in it. */
export const CENTRIFUGE_ENVIRONMENT_FACTS: Record<CentrifugeEnvironment, { indexerUrl: string }> = {
  mainnet: { indexerUrl: 'https://api.centrifuge.io' },
  testnet: { indexerUrl: 'https://api-v3-test.cfg.embrio.tech' }
};

/** The one deposit asset every Zivoe Vault accepts — a global product assumption, instantiated per chain. */
export type UsdcInstance = { address: Address; symbol: string; decimals: number };

/**
 * USDC's base-unit scale — a global product assumption (Circle-native USDC
 * is 6 decimals on every chain Zivoe serves). Hub-level conversions use this
 * constant; chain-scoped code reads decimals off its chain deployment, which
 * is constructed from this same constant below — one author for the fact.
 * The per-chain values themselves are checked against the chain by
 * `pnpm centrifuge:verify`.
 */
export const USDC_DECIMALS = 6;

/** Each chain deployment authors only its USDC address; symbol and scale come from the one constant, so the instances cannot diverge. */
const usdcInstance = (address: Address): UsdcInstance => ({ address, symbol: 'USDC', decimals: USDC_DECIMALS });

/**
 * Everything a spoke chain is, in one record: its viem definition (the chain
 * id and RPC/explorer facts wallets and clients act on), the environment it
 * belongs to, and the protocol facts every share class on it shares.
 */
export type CentrifugeChainDeployment = {
  viem: Chain;
  environment: CentrifugeEnvironment;
  /** Alchemy's per-network subdomain — the environment's one key fans out to a distinct URL per chain. */
  alchemyNetwork: string;
  /** Deposits route through the chain's VaultRouter — the USDC approval spender. */
  vaultRouter: Address;
  usdc: UsdcInstance;
  /**
   * Whether the dApp offers cancelling a pending redemption request here.
   * Cancellation needs a hub-side unwind that is only automated where hub and
   * spoke are the same chain, so it stays off on spokes — a product decision,
   * flipped per chain once the unwind is supported there. Claims are never
   * gated on this: they only ever react to on-chain state that already exists.
   */
  supportsRedeemCancellation: boolean;
};

/**
 * viem ships no Pharos definition, so it is declared here — matching the one
 * the Centrifuge SDK carries internally, since both must act on the same
 * chain. It is also the source the dApp builds Dynamic's custom-network
 * entry from, Dynamic having no native Pharos support either.
 */
const pharos = defineChain({
  id: 1672,
  name: 'Pharos Mainnet',
  nativeCurrency: { name: 'PharosCoin', symbol: 'PROS', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.pharos.xyz'] } },
  blockExplorers: { default: { name: 'Pharos Explorer', url: 'https://pharosscan.xyz' } }
});

/**
 * Every spoke chain Zivoe deploys on. Order is PRODUCT order, not
 * alphabetical: each environment's first chain is its deployment's default
 * (DEFAULT_CHAIN, analytics fallback) and drives the chain selectors'
 * ordering — insert new chains behind the ones they should not displace.
 *
 * Reviews of new entries must verify the addresses on-chain; run
 * `pnpm centrifuge:verify` to compare every value here against the chain,
 * the SDK and the indexer before deploying.
 */
export const CENTRIFUGE_CHAIN_DEPLOYMENTS = {
  ethereum: {
    viem: mainnet,
    environment: 'mainnet',
    alchemyNetwork: 'eth-mainnet',
    vaultRouter: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    usdc: usdcInstance('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
    supportsRedeemCancellation: true
  },
  pharos: {
    viem: pharos,
    environment: 'mainnet',
    alchemyNetwork: 'pharos-mainnet',
    vaultRouter: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    usdc: usdcInstance('0xC879C018dB60520F4355C26eD1a6D572cdAC1815'),
    supportsRedeemCancellation: false
  },
  base: {
    viem: base,
    environment: 'mainnet',
    alchemyNetwork: 'base-mainnet',
    vaultRouter: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    usdc: usdcInstance('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
    supportsRedeemCancellation: false
  },
  arbitrum: {
    viem: arbitrum,
    environment: 'mainnet',
    alchemyNetwork: 'arb-mainnet',
    vaultRouter: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    usdc: usdcInstance('0xaf88d065e77c8cC2239327C5EDb3A432268e5831'),
    supportsRedeemCancellation: false
  },
  sepolia: {
    viem: sepolia,
    environment: 'testnet',
    alchemyNetwork: 'eth-sepolia',
    vaultRouter: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD',
    usdc: usdcInstance('0x3aaaa86458d576BafCB1B7eD290434F0696dA65c'),
    supportsRedeemCancellation: true
  },
  'base-sepolia': {
    viem: baseSepolia,
    environment: 'testnet',
    alchemyNetwork: 'base-sepolia',
    vaultRouter: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD',
    usdc: usdcInstance('0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
    supportsRedeemCancellation: false
  }
} as const satisfies Record<string, CentrifugeChainDeployment>;

export type CentrifugeChain = keyof typeof CENTRIFUGE_CHAIN_DEPLOYMENTS;

/**
 * 20 bytes and not the zero placeholder — the shape every configured address
 * must have. Internal to the package's import-time lints: `Address` only
 * types the 0x prefix, so a truncated paste or a leftover zero placeholder
 * needs a runtime sweep to fail the build instead of a transaction.
 */
export function isPlausibleAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0+$/.test(address);
}

for (const [chain, deployment] of Object.entries(CENTRIFUGE_CHAIN_DEPLOYMENTS)) {
  for (const [contract, address] of [
    ['VaultRouter', deployment.vaultRouter],
    ['USDC', deployment.usdc.address]
  ] as const) {
    if (!isPlausibleAddress(address))
      throw new Error(`The ${contract} address on "${chain}" is implausible: "${address}".`);
  }
}

/** The chains of one environment, as a type — lets share-class entries only claim chains of their own hub. */
export type CentrifugeChainOf<E extends CentrifugeEnvironment> = {
  [C in CentrifugeChain]: (typeof CENTRIFUGE_CHAIN_DEPLOYMENTS)[C]['environment'] extends E ? C : never;
}[CentrifugeChain];

/** Every chain in canonical (product) order. */
export const CENTRIFUGE_CHAINS = Object.keys(CENTRIFUGE_CHAIN_DEPLOYMENTS) as Array<CentrifugeChain>;

export function getChainDeployment(chain: CentrifugeChain): CentrifugeChainDeployment {
  return CENTRIFUGE_CHAIN_DEPLOYMENTS[chain];
}

export function getChainId(chain: CentrifugeChain): number {
  return CENTRIFUGE_CHAIN_DEPLOYMENTS[chain].viem.id;
}

/**
 * Ordered RPC URLs for one chain: the dedicated Alchemy endpoint first (when
 * the chain environment's key is given), then the chain's viem public
 * defaults as failover — so an Alchemy incident degrades to public RPCs.
 */
export function getChainRpcUrls({
  chain,
  alchemyKey
}: {
  chain: CentrifugeChain;
  alchemyKey: string | undefined;
}): Array<string> {
  const { alchemyNetwork, viem } = CENTRIFUGE_CHAIN_DEPLOYMENTS[chain];
  const alchemyUrl = alchemyKey ? `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}` : undefined;
  return [...(alchemyUrl ? [alchemyUrl] : []), ...viem.rpcUrls.default.http];
}

/** The environment's chains in canonical (CENTRIFUGE_CHAINS) order. */
export function chainsOfEnvironment(environment: CentrifugeEnvironment): Array<CentrifugeChain> {
  return CENTRIFUGE_CHAINS.filter((chain) => CENTRIFUGE_CHAIN_DEPLOYMENTS[chain].environment === environment);
}
