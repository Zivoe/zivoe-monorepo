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
 */
type WithProtocolAddresses = { _protocolAddresses(centrifugeId: number): Promise<{ vaultRouter: `0x${string}` }> };

/**
 * Resolves the share class's Centrifuge vault and asserts the configuration against the
 * chain's own answers: the SDK-resolved Centrifuge-vault address must equal the
 * configured one (two sources for one fact, checked once), and the Centrifuge vault must
 * report the sync-deposit/async-redeem shape the flows are built around. A
 * misconfigured or async-deposit class fails loudly at first use instead of
 * breaking mid-transaction.
 */
async function resolveCentrifugeVault(centrifugeVault: TransactedCentrifugeVault): Promise<CentrifugeVaultEntity> {
  const { shareClass } = centrifugeVault;
  const centrifuge = getCentrifuge();

  const [centrifugeId, pool] = await Promise.all([
    centrifuge.id(centrifugeVault.chainId),
    centrifuge.pool(new PoolId(shareClass.poolId))
  ]);

  const resolved = await pool.vault(centrifugeId, new ShareClassId(shareClass.scId), centrifugeVault.usdc.address);

  if (resolved.address.toLowerCase() !== centrifugeVault.address.toLowerCase())
    throw new Error(
      `The SDK resolved Centrifuge vault ${resolved.address} for share class "${shareClass.key}" on "${centrifugeVault.chain}", but ${centrifugeVault.address} is configured. Fix the configuration before transacting.`
    );

  const [details, { vaultRouter }] = await Promise.all([
    resolved.details(),
    (centrifuge as Centrifuge & WithProtocolAddresses)._protocolAddresses(centrifugeId)
  ]);
  if (!details.isSyncDeposit || details.isSyncRedeem)
    throw new Error(
      `The Centrifuge vault for share class "${shareClass.key}" on "${centrifugeVault.chain}" is not sync-deposit/async-redeem. The flows do not support this Centrifuge-vault shape.`
    );

  // The share token address is hand-entered per chain and nothing else
  // validates it (the hub reads filter by scId): a typo would misread wallet
  // balances while every metric renders fine, failing only at simulate.
  if (details.share.address.toLowerCase() !== shareClass.shareTokenAddress.toLowerCase())
    throw new Error(
      `Share class "${shareClass.key}" is configured with share token ${shareClass.shareTokenAddress} on "${centrifugeVault.chain}" but the Centrifuge vault reports ${details.share.address}. Fix the catalog before transacting.`
    );

  // Decimals are hand-entered configuration scaling every parseUnits and
  // share→USDC conversion — the one money fact with no other guard, so both
  // tokens are asserted against the chain's own answer in this same pass.
  if (details.share.decimals !== shareClass.decimals)
    throw new Error(
      `Share class "${shareClass.key}" is configured with ${shareClass.decimals} decimals but its share token on "${centrifugeVault.chain}" reports ${details.share.decimals}. Fix the catalog before transacting.`
    );

  if (details.asset.decimals !== centrifugeVault.usdc.decimals)
    throw new Error(
      `USDC on "${centrifugeVault.chain}" is configured with ${centrifugeVault.usdc.decimals} decimals but the Centrifuge vault's asset reports ${details.asset.decimals}. Fix the chain config before transacting.`
    );

  // The VaultRouter is hand-entered per chain and is the USDC approval
  // spender — the highest-stakes address in the chain config, and the only
  // one nothing else validates: deposit and claim calls byte-compare their
  // `to` at simulate, but the approval's spender is our own construction,
  // and the approval is signed BEFORE the first simulate could catch it.
  if (vaultRouter.toLowerCase() !== centrifugeVault.vaultRouterAddress.toLowerCase())
    throw new Error(
      `The VaultRouter on "${centrifugeVault.chain}" is configured as ${centrifugeVault.vaultRouterAddress} but the SDK reports ${vaultRouter}. Fix the chain config before transacting.`
    );

  return resolved;
}
