import Centrifuge, { PoolId, ShareClassId } from '@centrifuge/sdk';
import { parseAbi } from 'viem';

import { env } from '@/env';

import { CENTRIFUGE_CONFIG } from './config';
import { type VaultEntity } from './entities';

let client: Centrifuge | undefined;
let vaultPromise: Promise<VaultEntity> | undefined;

function getCentrifuge(): Centrifuge {
  if (typeof window === 'undefined')
    throw new Error('The Centrifuge SDK client is client-only and must never be constructed on the server.');

  if (!client) {
    const rpcUrls = (
      CENTRIFUGE_CONFIG.network === 'mainnet'
        ? [env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY, env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY]
        : [env.NEXT_PUBLIC_SEPOLIA_RPC_URL_PRIMARY, env.NEXT_PUBLIC_SEPOLIA_RPC_URL_SECONDARY]
    ).filter((url): url is string => Boolean(url));

    client = new Centrifuge({
      environment: CENTRIFUGE_CONFIG.environment,
      indexerUrl: CENTRIFUGE_CONFIG.indexerUrl,
      ...(rpcUrls.length > 0 ? { rpcUrls: { [CENTRIFUGE_CONFIG.chainId]: rpcUrls } } : {}),
      permitDisabled: true,
      disableRepeatOnEvents: true
    });
  }

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
