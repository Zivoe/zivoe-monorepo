import { type Address } from 'viem';

import { CENTRIFUGE_NETWORK_FACTS, type CentrifugeNetwork, type ShareClassIdentity } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

/**
 * Facts of the deployment network itself, shared by every Zivoe Vault: one chain,
 * one SDK environment, one indexer, one VaultRouter, one deposit asset. These
 * stay a singleton by design — per-Zivoe-Vault variability lives in
 * ShareClassConfig.
 */
type CentrifugeEnvironment = {
  network: CentrifugeNetwork;
  chainId: number;
  /** The SDK environment flag — selects its chain set and defaults. */
  environment: 'mainnet' | 'testnet';
  indexerUrl: string;
  /** Deposits route through the VaultRouter — the USDC approval spender. */
  vaultRouterAddress: Address;
  /** The one deposit asset every Zivoe Vault accepts — a global product assumption. */
  usdc: { address: Address; symbol: string; decimals: number };
};

const ENVIRONMENT_CONSTANTS: Record<
  CentrifugeNetwork,
  Omit<CentrifugeEnvironment, 'network' | 'chainId' | 'indexerUrl'> & { deployable: boolean }
> = {
  sepolia: {
    environment: 'testnet',
    vaultRouterAddress: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD',
    usdc: { address: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c', symbol: 'USDC', decimals: 6 },
    deployable: true
  },
  mainnet: {
    environment: 'mainnet',
    vaultRouterAddress: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    usdc: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    deployable: true
  }
};

function getCentrifugeEnvironment(network: CentrifugeNetwork): CentrifugeEnvironment {
  const { deployable, ...constants } = ENVIRONMENT_CONSTANTS[network];

  if (!deployable)
    throw new Error(
      `Centrifuge environment config for "${network}" is a non-deployable placeholder. Replace it with operator-verified values before deploying.`
    );

  // deployable: true asserts operator-verified values — zero addresses under
  // that flag are a flipped flag, not a staged network.
  if (/^0x0+$/i.test(constants.vaultRouterAddress) || /^0x0+$/i.test(constants.usdc.address))
    throw new Error(`Centrifuge environment config for "${network}" is deployable but carries placeholder addresses.`);

  return { ...constants, network, ...CENTRIFUGE_NETWORK_FACTS[network] };
}

export const CENTRIFUGE_ENV = getCentrifugeEnvironment(env.NEXT_PUBLIC_NETWORK);

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
 * 18-decimal USD value of a share amount at an 18-decimal Share Price. NAV is
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
