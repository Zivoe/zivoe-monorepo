import Centrifuge, { PoolId, ShareClassId } from '@centrifuge/sdk';

import { NETWORK_RPC_URLS } from '@/lib/network';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_ENV } from './config';
import { type CentrifugeVaultEntity } from './entities';
import { type TransactedShareClass } from './types';

let client: Centrifuge | undefined;
const centrifugeVaultPromises = new Map<string, Promise<CentrifugeVaultEntity>>();
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

/** Centrifuge-vault resolution is memoized per share class and Centrifuge vault; a failed resolve retries on the next call. */
export function getCentrifugeVault(shareClass: TransactedShareClass): Promise<CentrifugeVaultEntity> {
  // The Centrifuge-vault address is part of the key: a memo keyed by class alone would
  // let one cached Centrifuge vault answer for a different address under the same key,
  // skipping resolveCentrifugeVault's address assertion (e.g. the day a class carries a
  // second deposit asset's Centrifuge vault).
  const memoKey = `${shareClass.key}:${shareClass.centrifugeVaultAddress.toLowerCase()}`;

  const existing = centrifugeVaultPromises.get(memoKey);
  if (existing) return existing;

  const centrifugeVaultPromise = resolveCentrifugeVault(shareClass).catch((error: unknown) => {
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
 * Resolves the share class's Centrifuge vault and asserts the configuration against the
 * chain's own answers: the SDK-resolved Centrifuge-vault address must equal the
 * configured one (two sources for one fact, checked once), and the Centrifuge vault must
 * report the sync-deposit/async-redeem shape the flows are built around. A
 * misconfigured or async-deposit class fails loudly at first use instead of
 * breaking mid-transaction.
 */
async function resolveCentrifugeVault(shareClass: TransactedShareClass): Promise<CentrifugeVaultEntity> {
  const centrifuge = getCentrifuge();

  const [centrifugeId, pool] = await Promise.all([
    centrifuge.id(CENTRIFUGE_ENV.chainId),
    centrifuge.pool(new PoolId(shareClass.poolId))
  ]);

  const centrifugeVault = await pool.vault(
    centrifugeId,
    new ShareClassId(shareClass.scId),
    CENTRIFUGE_ENV.usdc.address
  );

  if (centrifugeVault.address.toLowerCase() !== shareClass.centrifugeVaultAddress.toLowerCase())
    throw new Error(
      `The SDK resolved Centrifuge vault ${centrifugeVault.address} for share class "${shareClass.key}", but ${shareClass.centrifugeVaultAddress} is configured. Fix the configuration before transacting.`
    );

  const details = await centrifugeVault.details();
  if (!details.isSyncDeposit || details.isSyncRedeem)
    throw new Error(
      `The Centrifuge vault for share class "${shareClass.key}" is not sync-deposit/async-redeem. The flows do not support this Centrifuge-vault shape.`
    );

  // Decimals are hand-entered configuration scaling every parseUnits and
  // share→USDC conversion — the one money fact with no other guard, so both
  // tokens are asserted against the chain's own answer in this same pass.
  if (details.share.decimals !== shareClass.decimals)
    throw new Error(
      `Share class "${shareClass.key}" is configured with ${shareClass.decimals} decimals but its share token reports ${details.share.decimals}. Fix the catalog before transacting.`
    );

  if (details.asset.decimals !== CENTRIFUGE_ENV.usdc.decimals)
    throw new Error(
      `USDC is configured with ${CENTRIFUGE_ENV.usdc.decimals} decimals but the Centrifuge vault's asset reports ${details.asset.decimals}. Fix the environment config before transacting.`
    );

  return centrifugeVault;
}
