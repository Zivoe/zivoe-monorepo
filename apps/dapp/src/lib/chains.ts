import { type Chain } from 'viem';

import {
  CENTRIFUGE_CHAINS,
  type CentrifugeChain,
  chainsOfEnvironment,
  getChainDeployment,
  getChainId,
  getChainRpcUrls as getChainRpcUrlsFor
} from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

/**
 * The deployment's environment, NODE_ENV-style: testnet for development
 * and previews, mainnet for production. Every chain of the environment is
 * active; which of them a Zivoe Vault actually serves is the catalog's
 * business (its per-chain `status`), not the env var's.
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

export function getViemChain(chain: CentrifugeChain): Chain {
  return getChainDeployment(chain).viem;
}

export { getChainId };

/**
 * Ordered RPC URLs for one chain: the deployment's dedicated Alchemy endpoint
 * first (when the chain environment's key is configured — testnet's is
 * optional), then the chain's viem public defaults as failover. Every
 * consumer (wagmi transports, the Centrifuge SDK, server reads) rides this
 * one list, so an Alchemy incident degrades to public RPCs instead of taking
 * down every read and receipt wait.
 */
export function getChainRpcUrls(chain: CentrifugeChain): Array<string> {
  const alchemyKey =
    getChainDeployment(chain).environment === 'mainnet'
      ? env.NEXT_PUBLIC_MAINNET_ALCHEMY_KEY
      : env.NEXT_PUBLIC_TESTNET_ALCHEMY_KEY;

  return getChainRpcUrlsFor({ chain, alchemyKey });
}

// Built once at import like the module's other per-chain lookups.
const CHAIN_OF_CHAIN_ID: Partial<Record<number, CentrifugeChain>> = Object.fromEntries(
  CENTRIFUGE_CHAINS.map((chain) => [getChainId(chain), chain])
);

/** The registry chain behind an EVM chain id, or undefined for a chain the app does not know. */
export function chainOfChainId(chainId: number): CentrifugeChain | undefined {
  return CHAIN_OF_CHAIN_ID[chainId];
}

export const ACTIVE_CHAIN_IDS: Array<number> = ACTIVE_CHAINS.map(getChainId);

export function isActiveChainId(chainId: number | undefined): boolean {
  return chainId !== undefined && ACTIVE_CHAIN_IDS.includes(chainId);
}
