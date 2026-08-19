import { type Chain, defineChain } from 'viem';
import { baseSepolia, mainnet, sepolia } from 'viem/chains';

import { CENTRIFUGE_CHAIN_FACTS, type CentrifugeChain, chainsOfEnvironment } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

/**
 * The deployment's environment, NODE_ENV-style: testnet for development
 * and previews, mainnet for production. Every chain of the environment is
 * active; which of them a Zivoe Vault actually serves is the deployable flags'
 * business (catalog + Zivoe Vault modules), not the env var's.
 */
export const ACTIVE_ENVIRONMENT = env.NEXT_PUBLIC_CHAIN_ENV;

export const ACTIVE_CHAINS: Array<CentrifugeChain> = chainsOfEnvironment(ACTIVE_ENVIRONMENT);

const [firstActiveChain] = ACTIVE_CHAINS;
// Unreachable — both environments carry chains — but it types the export.
if (!firstActiveChain) throw new Error(`Environment "${ACTIVE_ENVIRONMENT}" has no chains.`);

/**
 * The environment's canonical chain (ethereum / sepolia) — the fallback for
 * chain-agnostic surfaces only (analytics chain_id, the archived server
 * client). NOT the flow selectors' default: those default to the Zivoe
 * Vault's own first live chain, which can differ once a launch is staged.
 */
export const DEFAULT_CHAIN: CentrifugeChain = firstActiveChain;

/**
 * viem ships no Pharos definition, so the app declares it — matching the one
 * the Centrifuge SDK carries internally, since both must act on the same
 * chain. It is also the source Dynamic's custom-network entry is built from,
 * Dynamic having no native Pharos support either.
 */
export const pharos = defineChain({
  id: 1672,
  name: 'Pharos Mainnet',
  nativeCurrency: { name: 'PharosCoin', symbol: 'PROS', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.pharos.xyz'] } },
  blockExplorers: { default: { name: 'Pharos Explorer', url: 'https://pharosscan.xyz' } }
});

const VIEM_CHAINS: Record<CentrifugeChain, Chain> = {
  ethereum: mainnet,
  pharos,
  sepolia,
  'base-sepolia': baseSepolia
};

// Two hardcoded sources for one fact, cross-checked once at import: the viem
// chain wagmi/wallets act on must be the chain the catalog reasons about.
for (const [chain, viemChain] of Object.entries(VIEM_CHAINS) as Array<[CentrifugeChain, Chain]>) {
  if (viemChain.id !== CENTRIFUGE_CHAIN_FACTS[chain].chainId)
    throw new Error(
      `Chain "${chain}" maps to viem chain id ${String(viemChain.id)} but the catalog declares ${String(
        CENTRIFUGE_CHAIN_FACTS[chain].chainId
      )}.`
    );
}

export function getViemChain(chain: CentrifugeChain): Chain {
  return VIEM_CHAINS[chain];
}

export function getChainId(chain: CentrifugeChain): number {
  return CENTRIFUGE_CHAIN_FACTS[chain].chainId;
}

// Alchemy's per-network subdomain for each chain — the environment's one key
// fans out to a distinct URL per chain, so the key's Alchemy app must have
// every chain of its environment enabled.
const ALCHEMY_NETWORK: Record<CentrifugeChain, string> = {
  ethereum: 'eth-mainnet',
  pharos: 'pharos-mainnet',
  sepolia: 'eth-sepolia',
  'base-sepolia': 'base-sepolia'
};

/**
 * Ordered RPC URLs for one chain: the deployment's dedicated Alchemy endpoint
 * first (when the chain environment's key is configured — testnet's is
 * optional), then the chain's viem public defaults as failover. Every
 * consumer (wagmi transports, the Centrifuge SDK, server reads) rides this
 * one list, so an Alchemy incident degrades to public RPCs instead of taking
 * down every read and receipt wait.
 */
export function getChainRpcUrls(chain: CentrifugeChain): Array<string> {
  const key =
    CENTRIFUGE_CHAIN_FACTS[chain].environment === 'mainnet'
      ? env.NEXT_PUBLIC_MAINNET_ALCHEMY_KEY
      : env.NEXT_PUBLIC_TESTNET_ALCHEMY_KEY;

  const alchemyUrl = key ? `https://${ALCHEMY_NETWORK[chain]}.g.alchemy.com/v2/${key}` : undefined;
  return [...(alchemyUrl ? [alchemyUrl] : []), ...VIEM_CHAINS[chain].rpcUrls.default.http];
}

export const ACTIVE_CHAIN_IDS: Array<number> = ACTIVE_CHAINS.map(getChainId);

export function isActiveChainId(chainId: number | undefined): boolean {
  return chainId !== undefined && ACTIVE_CHAIN_IDS.includes(chainId);
}
