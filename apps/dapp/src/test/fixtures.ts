import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { type TransactedCentrifugeVault, type TransactionIdentity } from '@/centrifuge';
import { getChainConfig } from '@/centrifuge/config';

/**
 * A synthetic share class for hook tests — deliberately distinct symbol and
 * decimals from zSMB (and never present in the production catalog or the
 * registry) so decimal-dependent math and identity plumbing cannot pass by
 * coincidence. Every hook assertion (copy, query keys, invalidations, Centrifuge-vault
 * resolution, receipt decoding, payload snapshots) must follow this object.
 */
export const FIXTURE_IDENTITY: TransactionIdentity = {
  zivoeVaultSlug: 'fixture-zivoe-vault',
  centrifugeVault: {
    // The test deployment's single active chain (see test/setup.ts) — the
    // hooks pin their clients to this chainId, and read the chain's real
    // USDC/VaultRouter facts off the identity like the app resolves them.
    chain: 'sepolia',
    chainId: 11155111,
    address: '0xfafafafafafafafafafafafafafafafafafafafa',
    usdc: getChainConfig('sepolia').usdc,
    vaultRouterAddress: getChainConfig('sepolia').vaultRouterAddress,
    supportsRedeemCancellation: getChainConfig('sepolia').supportsRedeemCancellation,
    shareClass: {
      key: 'zfix',
      symbol: 'zFIX',
      decimals: 8,
      poolId: '281474976999999',
      scId: '0x000100000000ffff0000000000000001',
      shareTokenAddress: '0xf1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1'
    }
  }
};

/** The fixture's Centrifuge-vault address as query keys carry it — lowercased, like the key builder. */
export const FIXTURE_CENTRIFUGE_VAULT = FIXTURE_IDENTITY.centrifugeVault.address.toLowerCase();

/**
 * An identity re-pinned to another chain — the shared shape behind every
 * suite's "same class, second chain" fixture, so the spreads cannot drift
 * apart. The chainId comes from the real chain config; the per-chain
 * instances (Centrifuge-vault address, USDC, router, share token) stay
 * overridable so a suite can pin deliberately distinct addresses per chain.
 */
export function identityOnChain(
  base: TransactionIdentity,
  chain: CentrifugeChain,
  overrides: Partial<Omit<TransactedCentrifugeVault, 'chain' | 'chainId' | 'shareClass'>> & {
    shareClass?: Partial<TransactedCentrifugeVault['shareClass']>;
  } = {}
): TransactionIdentity {
  const { shareClass: shareClassOverrides, ...centrifugeVaultOverrides } = overrides;

  return {
    ...base,
    centrifugeVault: {
      ...base.centrifugeVault,
      chain,
      chainId: getChainConfig(chain).chainId,
      supportsRedeemCancellation: getChainConfig(chain).supportsRedeemCancellation,
      ...centrifugeVaultOverrides,
      shareClass: { ...base.centrifugeVault.shareClass, ...shareClassOverrides }
    }
  };
}
