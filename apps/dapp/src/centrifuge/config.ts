import { type Address } from 'viem';

import {
  CENTRIFUGE_NETWORK_FACTS,
  type CentrifugeNetwork,
  type ShareClassIdentity,
  type ShareClassKey,
  getShareClassIdentity
} from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

/**
 * Facts of the deployment network itself, shared by every Offering: one chain,
 * one SDK environment, one indexer, one VaultRouter, one deposit asset. These
 * stay a singleton by design — per-Offering variability lives in
 * ShareClassConfig.
 */
export type CentrifugeEnvironment = {
  network: CentrifugeNetwork;
  chainId: number;
  /** The SDK environment flag — selects its chain set and defaults. */
  environment: 'mainnet' | 'testnet';
  indexerUrl: string;
  /** Deposits route through the VaultRouter — the USDC approval spender. */
  vaultRouterAddress: Address;
  usdc: { address: Address; decimals: number };
};

const ENVIRONMENT_CONSTANTS: Record<
  CentrifugeNetwork,
  Omit<CentrifugeEnvironment, 'network' | 'chainId' | 'indexerUrl'> & { deployable: boolean }
> = {
  sepolia: {
    environment: 'testnet',
    vaultRouterAddress: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD',
    usdc: { address: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c', decimals: 6 },
    deployable: true
  },
  mainnet: {
    // NON-DEPLOYABLE PLACEHOLDER: the zero USDC address does NOT fail loudly
    // on its own, so the guard below throws for this network independently of
    // the catalog's guard. Verify every entry (incl. VaultRouter) at mainnet
    // cutover.
    environment: 'mainnet',
    vaultRouterAddress: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    usdc: { address: '0x0000000000000000000000000000000000000000', decimals: 6 },
    deployable: false
  }
};

export function getCentrifugeEnvironment(network: CentrifugeNetwork): CentrifugeEnvironment {
  const { deployable, ...constants } = ENVIRONMENT_CONSTANTS[network];

  if (!deployable)
    throw new Error(
      `Centrifuge environment config for "${network}" is a non-deployable placeholder. Replace it with operator-verified values before deploying.`
    );

  return { ...constants, network, ...CENTRIFUGE_NETWORK_FACTS[network] };
}

export const CENTRIFUGE_ENV = getCentrifugeEnvironment(env.NEXT_PUBLIC_NETWORK);

/**
 * dApp-only share-class identity: the vault instantiating each class for USDC,
 * per network it claims. The same placeholder discipline as the catalog — a
 * claimed network with unverified values throws at resolution.
 */
const VAULTS: Record<ShareClassKey, Partial<Record<CentrifugeNetwork, { address: Address; deployable: boolean }>>> = {
  zmca: {
    sepolia: { address: '0x8D46D06C0D274F9e277e71606Db602e57A055644', deployable: true },
    // NON-DEPLOYABLE PLACEHOLDER: receipt decoding against the zero address
    // silently matches nothing, so the guard below throws instead.
    mainnet: { address: '0x0000000000000000000000000000000000000000', deployable: false }
  }
};

/** A share class's full dApp identity on the active network: catalog entry + vault. */
export type ShareClassConfig = ShareClassIdentity & {
  vaultAddress: Address;
};

export function getShareClassConfig(key: ShareClassKey): ShareClassConfig {
  const network = env.NEXT_PUBLIC_NETWORK;
  const identity = getShareClassIdentity({ network, key });
  const vault = VAULTS[key][network];

  if (!vault) throw new Error(`Share class "${key}" has no vault on "${network}".`);

  if (!vault.deployable)
    throw new Error(
      `The vault for share class "${key}" on "${network}" is a non-deployable placeholder. Replace it with an operator-verified address before deploying.`
    );

  return { ...identity, vaultAddress: vault.address };
}

/**
 * The zMCA share-class config — the identity every not-yet-parameterized
 * consumer still transacts against. Interim by design: it disappears as the
 * Transaction Hooks and flows take share-class identity explicitly.
 */
export const ZMCA_SHARE_CLASS = getShareClassConfig('zmca');

export type CentrifugeConfig = {
  network: CentrifugeNetwork;
  chainId: number;
  /** The SDK environment flag — selects its chain set and defaults. */
  environment: 'mainnet' | 'testnet';
  indexerUrl: string;
  /** Catalog key of the share class — the identity dimension of caches and query keys. */
  shareClassKey: ShareClassKey;
  poolId: string;
  scId: `0x${string}`;
  vaultAddress: Address;
  /** Deposits route through the VaultRouter — the USDC approval spender. */
  vaultRouterAddress: Address;
  shareToken: { address: Address; symbol: 'zMCA'; decimals: number };
  usdc: { address: Address; decimals: number };
};

/**
 * The legacy single-share-class config — a thin alias over the environment
 * singleton and the zMCA Offering's share class, kept so existing consumers
 * stay green while identity is threaded per Offering.
 */
export function getCentrifugeConfig(network: CentrifugeNetwork): CentrifugeConfig {
  const environment = getCentrifugeEnvironment(network);
  const zmca = getShareClassIdentity({ network, key: 'zmca' });
  const vault = VAULTS.zmca[network];

  if (!vault?.deployable)
    throw new Error(
      `The vault for share class "zmca" on "${network}" is a non-deployable placeholder. Replace it with an operator-verified address before deploying.`
    );

  return {
    network,
    chainId: environment.chainId,
    environment: environment.environment,
    indexerUrl: environment.indexerUrl,
    shareClassKey: zmca.key,
    poolId: zmca.poolId,
    scId: zmca.scId,
    vaultAddress: vault.address,
    vaultRouterAddress: environment.vaultRouterAddress,
    shareToken: { address: zmca.shareTokenAddress, symbol: zmca.symbol, decimals: zmca.decimals },
    usdc: environment.usdc
  };
}

export const CENTRIFUGE_CONFIG = getCentrifugeConfig(env.NEXT_PUBLIC_NETWORK);

/**
 * Indicative USDC (base units) for a share amount at an 18-decimal Share
 * Price. Lives beside the config because it is pure decimal math over it,
 * and — like the config — is the only piece server code may import.
 */
export function sharesToUsdc({
  shares,
  sharePrice,
  shareClass
}: {
  shares: bigint;
  sharePrice: bigint;
  shareClass: Pick<ShareClassIdentity, 'decimals'>;
}): bigint {
  return (shares * sharePrice) / 10n ** BigInt(shareClass.decimals) / 10n ** BigInt(18 - CENTRIFUGE_ENV.usdc.decimals);
}

/**
 * 18-decimal USD value of a share amount at an 18-decimal Share Price. AUM is
 * the same conversion applied to the class's total issuance.
 */
export function sharesToValueD18({
  shares,
  sharePrice,
  shareClass
}: {
  shares: bigint;
  sharePrice: bigint;
  shareClass: Pick<ShareClassIdentity, 'decimals'>;
}): bigint {
  return (shares * sharePrice) / 10n ** BigInt(shareClass.decimals);
}
