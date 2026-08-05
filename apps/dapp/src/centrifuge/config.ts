import { type Address } from 'viem';

import { type CentrifugeNetwork, getCentrifugeIndexerConfig } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

export type CentrifugeConfig = {
  network: CentrifugeNetwork;
  chainId: number;
  /** The SDK environment flag — selects its chain set and defaults. */
  environment: 'mainnet' | 'testnet';
  indexerUrl: string;
  poolId: string;
  scId: `0x${string}`;
  vaultAddress: Address;
  /** Deposits route through the VaultRouter — the USDC approval spender. */
  vaultRouterAddress: Address;
  shareToken: { address: Address; symbol: 'zMCA'; decimals: number };
  usdc: { address: Address; decimals: number };
};

const SDK_CONSTANTS: Record<
  CentrifugeNetwork,
  Omit<CentrifugeConfig, 'network' | 'chainId' | 'indexerUrl' | 'poolId' | 'scId' | 'shareToken'> & {
    shareToken: Omit<CentrifugeConfig['shareToken'], 'address'>;
    deployable: boolean;
  }
> = {
  sepolia: {
    environment: 'testnet',
    vaultAddress: '0x8D46D06C0D274F9e277e71606Db602e57A055644',
    vaultRouterAddress: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD',
    shareToken: { symbol: 'zMCA', decimals: 18 },
    usdc: { address: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c', decimals: 6 },
    deployable: true
  },
  mainnet: {
    // NON-DEPLOYABLE PLACEHOLDER: the zero addresses do NOT fail loudly on
    // their own (receipt decoding just matches nothing), so the guard below
    // throws for this network independently of the indexer package's guard.
    // Verify every entry (incl. VaultRouter) at mainnet cutover.
    environment: 'mainnet',
    vaultAddress: '0x0000000000000000000000000000000000000000',
    vaultRouterAddress: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    shareToken: { symbol: 'zMCA', decimals: 18 },
    usdc: { address: '0x0000000000000000000000000000000000000000', decimals: 6 },
    deployable: false
  }
};

export function getCentrifugeConfig(network: CentrifugeNetwork): CentrifugeConfig {
  const indexer = getCentrifugeIndexerConfig(network);
  const { deployable, ...constants } = SDK_CONSTANTS[network];

  if (!deployable)
    throw new Error(
      `Centrifuge SDK config for "${network}" is a non-deployable placeholder. Replace it with operator-verified values before deploying.`
    );

  return {
    ...constants,
    network,
    chainId: indexer.chainId,
    indexerUrl: indexer.indexerUrl,
    poolId: indexer.poolId,
    scId: indexer.scId,
    shareToken: { ...constants.shareToken, address: indexer.shareTokenAddress }
  };
}

export const CENTRIFUGE_CONFIG = getCentrifugeConfig(env.NEXT_PUBLIC_NETWORK);

/**
 * Indicative USDC (base units) for a zMCA amount at an 18-decimal Share Price.
 * Lives beside the config because it is pure decimal math over it, and — like
 * the config — is the only piece server code may import.
 */
export function sharesToUsdc({ shares, sharePrice }: { shares: bigint; sharePrice: bigint }): bigint {
  return (
    (shares * sharePrice) /
    10n ** BigInt(CENTRIFUGE_CONFIG.shareToken.decimals) /
    10n ** BigInt(18 - CENTRIFUGE_CONFIG.usdc.decimals)
  );
}

/**
 * 18-decimal USD value of a zMCA amount at an 18-decimal Share Price. AUM is
 * the same conversion applied to the class's total issuance.
 */
export function sharesToValueD18({ shares, sharePrice }: { shares: bigint; sharePrice: bigint }): bigint {
  return (shares * sharePrice) / 10n ** BigInt(CENTRIFUGE_CONFIG.shareToken.decimals);
}
