import { type Address } from 'viem';

import {
  CENTRIFUGE_CHAIN_FACTS,
  CENTRIFUGE_ENVIRONMENT_FACTS,
  type CentrifugeChain,
  type ShareClassIdentity,
  ZERO_HEX
} from '@zivoe/centrifuge-indexer';

import { ACTIVE_ENVIRONMENT } from '@/lib/chains';

/**
 * Facts of the deployment's Centrifuge environment, shared by every Zivoe
 * Vault and every chain: one SDK environment flag, one indexer. This stays a
 * singleton by design — per-chain variability lives in CentrifugeChainConfig,
 * per-Zivoe-Vault variability in the Zivoe Vault modules.
 */
export const CENTRIFUGE_ENV = {
  /** The SDK environment flag — selects its chain set and defaults. Same union as ours by construction. */
  environment: ACTIVE_ENVIRONMENT,
  indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[ACTIVE_ENVIRONMENT].indexerUrl
};

/** The one deposit asset every Zivoe Vault accepts — a global product assumption, instantiated per chain. */
export type UsdcInstance = { address: Address; symbol: string; decimals: number };

/** Facts of one spoke chain shared by every Zivoe Vault transacting on it. */
export type CentrifugeChainConfig = {
  chain: CentrifugeChain;
  chainId: number;
  /** Deposits route through the chain's VaultRouter — the USDC approval spender. */
  vaultRouterAddress: Address;
  usdc: UsdcInstance;
};

const CHAIN_CONSTANTS: Record<
  CentrifugeChain,
  Omit<CentrifugeChainConfig, 'chain' | 'chainId'> & { deployable: boolean }
> = {
  sepolia: {
    vaultRouterAddress: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD',
    usdc: { address: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c', symbol: 'USDC', decimals: 6 },
    deployable: true
  },
  'base-sepolia': {
    vaultRouterAddress: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD',
    usdc: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC', decimals: 6 },
    deployable: true
  },
  ethereum: {
    vaultRouterAddress: '0xF684014771C01e50B8B526968B3a1e33acDA63f6',
    usdc: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    deployable: true
  },
  // Staged: fill with operator-verified values when ops deploys the
  // Centrifuge vault on Monad (VaultRouter and Circle-native USDC).
  monad: {
    vaultRouterAddress: '0x0000000000000000000000000000000000000000',
    usdc: { address: '0x0000000000000000000000000000000000000000', symbol: 'USDC', decimals: 6 },
    deployable: false
  }
};

export function getChainConfig(chain: CentrifugeChain): CentrifugeChainConfig {
  const { deployable, ...constants } = CHAIN_CONSTANTS[chain];

  if (!deployable)
    throw new Error(
      `Centrifuge chain config for "${chain}" is a non-deployable placeholder. Replace it with operator-verified values before deploying.`
    );

  // deployable: true asserts operator-verified values — zero addresses under
  // that flag are a flipped flag, not a staged chain.
  if (ZERO_HEX.test(constants.vaultRouterAddress) || ZERO_HEX.test(constants.usdc.address))
    throw new Error(`Centrifuge chain config for "${chain}" is deployable but carries placeholder addresses.`);

  return { ...constants, chain, chainId: CENTRIFUGE_CHAIN_FACTS[chain].chainId };
}

/** Whether the chain's environment constants are operator-verified — the registry's availability filter reads this. */
export function isChainConfigDeployable(chain: CentrifugeChain): boolean {
  return CHAIN_CONSTANTS[chain].deployable;
}

/**
 * USDC's base-unit scale — a global product assumption (Circle-native USDC is
 * 6 decimals on every chain Zivoe serves), asserted per chain against the
 * Centrifuge vault's own answer at resolution. Hub-level conversions use this constant;
 * chain-scoped code reads decimals off its CentrifugeChainConfig.
 */
const USDC_DECIMALS = 6;

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
  return (shares * sharePrice) / 10n ** BigInt(shareClass.decimals) / 10n ** BigInt(18 - USDC_DECIMALS);
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
