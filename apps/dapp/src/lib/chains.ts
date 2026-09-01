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

/**
 * Receipt-to-readable-state catch-up margin per chain, in confirmations;
 * chains not listed need none. The Base chains serve Flashblock
 * preconfirmation receipts — a receipt is visible up to ~2s before its block
 * seals and `latest` state reflects it, so a read straight after the receipt
 * sees pre-transaction balances. The extra block also adds margin against
 * lagging replicas behind the fallback transport. Arbitrum's exposure is that
 * replica lag alone: its ~250ms blocks turn sub-second skew across the RPC
 * provider's fleet into whole blocks of staleness, so the receipt and the
 * refetch straight after it can be answered from different heads (observed
 * live as a stale post-approval allowance). The margin there costs one
 * ~250ms poll, not Base's ~2s.
 */
const CATCHUP_CONFIRMATIONS: Partial<Record<CentrifugeChain, number>> = { base: 2, 'base-sepolia': 2, arbitrum: 2 };

const CATCHUP_POLL_MS = 250;
const CATCHUP_TIMEOUT_MS = 8_000;

/**
 * Read-your-writes barrier for a fresh receipt: resolves once the client's
 * chain head reaches the receipt's block plus the chain's catch-up margin, so
 * reads after it see post-transaction state. The transaction drivers hold
 * their pending phase (toast and button) on this before surfacing the
 * transaction dialog — success shown over stale balances that flash-refetch
 * seconds later reads worse than a slightly longer pending state. Chains
 * without a margin resolve immediately with no RPC call, and the wait is
 * bounded: an RPC that errors or stays behind past the timeout releases the
 * dialog instead of pinning it. (Deliberately not waitForTransactionReceipt's
 * confirmations option, whose whole-polling-interval granularity would
 * overshoot the ~2s gap.)
 */
export async function waitForRpcCatchup({
  client,
  chainId,
  receiptBlock
}: {
  client: { getBlockNumber(args?: { cacheTime?: number }): Promise<bigint> };
  chainId: number;
  receiptBlock: bigint;
}) {
  const chain = chainOfChainId(chainId);
  const confirmations = (chain && CATCHUP_CONFIRMATIONS[chain]) ?? 1;
  if (confirmations === 1) return;

  const targetBlock = receiptBlock + BigInt(confirmations - 1);
  const deadline = Date.now() + CATCHUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    // cacheTime: 0 — viem otherwise caches getBlockNumber for the client's
    // polling interval, which would freeze the loop on its first answer. An
    // erroring RPC releases the wait (undefined) instead of pinning it.
    const head = await client.getBlockNumber({ cacheTime: 0 }).catch(() => undefined);
    if (head === undefined || head >= targetBlock) return;
    await new Promise((resolve) => setTimeout(resolve, CATCHUP_POLL_MS));
  }
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
