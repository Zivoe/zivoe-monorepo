import Centrifuge, { PoolId, ShareClassId } from '@centrifuge/sdk';

import { ACTIVE_CHAINS, getChainId, getChainRpcUrls } from '@/lib/chains';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_ENV } from './config';
import { type CentrifugeVaultEntity } from './entities';
import { type TransactedCentrifugeVault } from './types';

let client: Centrifuge | undefined;
const centrifugeVaultPromises = new Map<string, Promise<CentrifugeVaultEntity>>();
let signerInUse = false;

function getCentrifuge(): Centrifuge {
  if (typeof window === 'undefined')
    throw new Error('The Centrifuge SDK client is client-only and must never be constructed on the server.');

  // One client serves every active chain: the SDK routes per-chain calls by
  // chainId, and each chain's ordered URL list (dedicated endpoint first,
  // public failover after) replaces the SDK's own defaults.
  const rpcUrls = Object.fromEntries(ACTIVE_CHAINS.map((chain) => [getChainId(chain), getChainRpcUrls(chain)]));

  client ??= new Centrifuge({
    environment: CENTRIFUGE_ENV.environment,
    indexerUrl: CENTRIFUGE_ENV.indexerUrl,
    rpcUrls,
    permitDisabled: true,
    disableRepeatOnEvents: true
  });

  return client;
}

/** Centrifuge-vault resolution is memoized per share class, chain and Centrifuge vault; a failed resolve retries on the next call. */
export function getCentrifugeVault(centrifugeVault: TransactedCentrifugeVault): Promise<CentrifugeVaultEntity> {
  // The chain and Centrifuge-vault address are part of the key: a memo keyed
  // by class alone would let one chain's cached Centrifuge vault answer for
  // another chain (or for a different address under the same key), skipping
  // resolveCentrifugeVault's assertions — deterministic deploys make
  // same-address Centrifuge vaults on two chains perfectly plausible.
  const memoKey = `${centrifugeVault.shareClass.key}:${centrifugeVault.chain}:${centrifugeVault.address.toLowerCase()}`;

  const existing = centrifugeVaultPromises.get(memoKey);
  if (existing) return existing;

  const centrifugeVaultPromise = resolveCentrifugeVault(centrifugeVault).catch((error: unknown) => {
    // Guarded eviction: only this promise's own failure may evict, so a slow
    // failure can never drop a newer retry already stored under the key.
    if (centrifugeVaultPromises.get(memoKey) === centrifugeVaultPromise) centrifugeVaultPromises.delete(memoKey);
    throw error;
  });

  centrifugeVaultPromises.set(memoKey, centrifugeVaultPromise);
  return centrifugeVaultPromise;
}

/**
 * Installs the signer for exactly one transaction and returns its release —
 * call that in a finally block. The lock prevents overlapping transactions
 * from racing the SDK's instance-level signer state — which is why it stays
 * global across share classes; because release only exists for the
 * transaction that acquired the signer, a contender that threw here cannot
 * strip the in-flight transaction's signer or its lock.
 */
export function setTransactionSigner(signer: { request(...args: Array<never>): Promise<unknown> }): () => void {
  if (signerInUse) throw new AppError({ message: 'Another transaction is already in progress' });

  signerInUse = true;
  getCentrifuge().setSigner(signer);

  return () => {
    signerInUse = false;
    if (client) client.setSigner(null);
  };
}

/**
 * The SDK keeps no public accessor for its per-chain protocol addresses, so
 * the VaultRouter assertion reads the same internal query the SDK's own
 * writes resolve the router from. The dependency is version-pinned, and a
 * renamed internal fails loudly here — before any approval can be signed.
 * The field is undefined when the SDK dropped it: the indexer's answer
 * disagreed with the bundled allowlist — a mismatch, not an RPC flake.
 */
type WithProtocolAddresses = {
  _protocolAddresses(centrifugeId: number): Promise<{ vaultRouter: `0x${string}` | undefined }>;
};

/**
 * Resolves the share class's Centrifuge vault and asserts the two configured
 * facts that can genuinely diverge from the chain: the SDK-resolved
 * Centrifuge-vault address (from our pool id, share-class id and USDC) must
 * equal the configured one, and the protocol's live VaultRouter must equal
 * the configured approval spender. The router earns a runtime check because
 * it is protocol-level — Centrifuge can migrate it without any deploy on our
 * side, and the approval is signed before the first simulate could object.
 * Every other catalog fact (share token, decimals, Centrifuge-vault shape) is fixed
 * under our own addresses and verified before deploying by
 * `pnpm centrifuge:verify`. Checked once per session; a misconfigured class
 * fails loudly at first use instead of mid-transaction.
 */
async function resolveCentrifugeVault(centrifugeVault: TransactedCentrifugeVault): Promise<CentrifugeVaultEntity> {
  const { shareClass } = centrifugeVault;
  const centrifuge = getCentrifuge();

  const [centrifugeId, pool] = await Promise.all([
    centrifuge.id(centrifugeVault.chainId),
    centrifuge.pool(new PoolId(shareClass.poolId))
  ]);

  const [resolved, { vaultRouter }] = await Promise.all([
    pool.vault(centrifugeId, new ShareClassId(shareClass.scId), centrifugeVault.usdc.address),
    (centrifuge as Centrifuge & WithProtocolAddresses)._protocolAddresses(centrifugeId)
  ]);

  if (resolved.address.toLowerCase() !== centrifugeVault.address.toLowerCase())
    throw new Error(
      `The SDK resolved Centrifuge vault ${resolved.address} for share class "${shareClass.key}" on "${centrifugeVault.chain}", but ${centrifugeVault.address} is configured. Fix the catalog before transacting.`
    );

  if (vaultRouter === undefined)
    throw new Error(
      `The SDK dropped the indexer-reported VaultRouter on "${centrifugeVault.chain}" — it disagrees with the SDK's bundled allowlist. Reconcile the SDK version and the catalog before transacting.`
    );

  if (vaultRouter.toLowerCase() !== centrifugeVault.vaultRouterAddress.toLowerCase())
    throw new Error(
      `The protocol's VaultRouter on "${centrifugeVault.chain}" is ${vaultRouter}, but ${centrifugeVault.vaultRouterAddress} is configured as the approval spender. Fix the catalog before transacting.`
    );

  return resolved;
}
