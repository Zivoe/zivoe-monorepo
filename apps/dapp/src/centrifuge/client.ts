import Centrifuge, { PoolId, ShareClassId } from '@centrifuge/sdk';

import { NETWORK_RPC_URLS } from '@/lib/network';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_ENV } from './config';
import { type VaultEntity } from './entities';
import { type TransactedShareClass } from './types';

let client: Centrifuge | undefined;
const vaultPromises = new Map<string, Promise<VaultEntity>>();
let signerInUse = false;

function getCentrifuge(): Centrifuge {
  if (typeof window === 'undefined')
    throw new Error('The Centrifuge SDK client is client-only and must never be constructed on the server.');

  client ??= new Centrifuge({
    environment: CENTRIFUGE_ENV.environment,
    indexerUrl: CENTRIFUGE_ENV.indexerUrl,
    ...(NETWORK_RPC_URLS.length > 0 ? { rpcUrls: { [CENTRIFUGE_ENV.chainId]: NETWORK_RPC_URLS } } : {}),
    permitDisabled: true,
    disableRepeatOnEvents: true
  });

  return client;
}

/** Vault resolution is memoized per share class; a failed resolve retries on the next call. */
export function getVault(shareClass: TransactedShareClass): Promise<VaultEntity> {
  const existing = vaultPromises.get(shareClass.key);
  if (existing) return existing;

  const vaultPromise = resolveVault(shareClass).catch((error: unknown) => {
    // Guarded eviction: only this promise's own failure may evict, so a slow
    // failure can never drop a newer retry already stored under the key.
    if (vaultPromises.get(shareClass.key) === vaultPromise) vaultPromises.delete(shareClass.key);
    throw error;
  });

  vaultPromises.set(shareClass.key, vaultPromise);
  return vaultPromise;
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
 * Resolves the share class's vault and asserts the configuration against the
 * chain's own answers: the SDK-resolved vault address must equal the
 * configured one (two sources for one fact, checked once), and the vault must
 * report the sync-deposit/async-redeem shape the flows are built around. A
 * misconfigured or async-deposit class fails loudly at first use instead of
 * breaking mid-transaction.
 */
async function resolveVault(shareClass: TransactedShareClass): Promise<VaultEntity> {
  const centrifuge = getCentrifuge();

  const [centrifugeId, pool] = await Promise.all([
    centrifuge.id(CENTRIFUGE_ENV.chainId),
    centrifuge.pool(new PoolId(shareClass.poolId))
  ]);

  const vault = await pool.vault(centrifugeId, new ShareClassId(shareClass.scId), CENTRIFUGE_ENV.usdc.address);

  if (vault.address.toLowerCase() !== shareClass.vaultAddress.toLowerCase())
    throw new Error(
      `The SDK resolved vault ${vault.address} for share class "${shareClass.key}", but ${shareClass.vaultAddress} is configured. Fix the configuration before transacting.`
    );

  const details = await vault.details();
  if (!details.isSyncDeposit || details.isSyncRedeem)
    throw new Error(
      `The vault for share class "${shareClass.key}" is not sync-deposit/async-redeem. The flows do not support this vault shape.`
    );

  return vault;
}
