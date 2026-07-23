import Centrifuge, { PoolId, ShareClassId } from '@centrifuge/sdk';

import { NETWORK_RPC_URLS } from '@/lib/network';

import { CENTRIFUGE_CONFIG } from './config';
import { type VaultEntity } from './entities';

let client: Centrifuge | undefined;
let vaultPromise: Promise<VaultEntity> | undefined;

function getCentrifuge(): Centrifuge {
  if (typeof window === 'undefined')
    throw new Error('The Centrifuge SDK client is client-only and must never be constructed on the server.');

  client ??= new Centrifuge({
    environment: CENTRIFUGE_CONFIG.environment,
    indexerUrl: CENTRIFUGE_CONFIG.indexerUrl,
    ...(NETWORK_RPC_URLS.length > 0 ? { rpcUrls: { [CENTRIFUGE_CONFIG.chainId]: NETWORK_RPC_URLS } } : {}),
    permitDisabled: true,
    disableRepeatOnEvents: true
  });

  return client;
}

export function getVault(): Promise<VaultEntity> {
  vaultPromise ??= resolveVault().catch((error: unknown) => {
    vaultPromise = undefined;
    throw error;
  });

  return vaultPromise;
}

async function resolveVault(): Promise<VaultEntity> {
  const centrifuge = getCentrifuge();

  const [centrifugeId, pool] = await Promise.all([
    centrifuge.id(CENTRIFUGE_CONFIG.chainId),
    centrifuge.pool(new PoolId(CENTRIFUGE_CONFIG.poolId))
  ]);

  return pool.vault(centrifugeId, new ShareClassId(CENTRIFUGE_CONFIG.scId), CENTRIFUGE_CONFIG.usdc.address);
}
