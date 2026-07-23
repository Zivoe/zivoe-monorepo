import Centrifuge, { PoolId, ShareClassId } from '@centrifuge/sdk';
import { parseAbi } from 'viem';

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

const VAULT_PREVIEW_ABI = parseAbi(['function previewDeposit(uint256 assets) view returns (uint256 shares)']);

/**
 * The vault contract's own previewDeposit answer — the authoritative mint
 * quote, including whatever rounding the contract applies at execution.
 */
export async function readPreviewDeposit(assets: bigint): Promise<bigint> {
  const centrifuge = getCentrifuge();
  const centrifugeId = await centrifuge.id(CENTRIFUGE_CONFIG.chainId);
  const publicClient = await centrifuge.getClient(centrifugeId);

  return publicClient.readContract({
    abi: VAULT_PREVIEW_ABI,
    address: CENTRIFUGE_CONFIG.vaultAddress,
    functionName: 'previewDeposit',
    args: [assets]
  });
}
