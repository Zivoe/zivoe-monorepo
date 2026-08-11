import { type TransactionIdentity } from '@/centrifuge';

/**
 * A synthetic share class for hook tests — deliberately distinct symbol and
 * decimals from zSMB (and never present in the production catalog or the
 * registry) so decimal-dependent math and identity plumbing cannot pass by
 * coincidence. Every hook assertion (copy, query keys, invalidations, Centrifuge-vault
 * resolution, receipt decoding, payload snapshots) must follow this object.
 */
export const FIXTURE_IDENTITY: TransactionIdentity = {
  zivoeVaultSlug: 'fixture-zivoe-vault',
  shareClass: {
    key: 'zfix',
    symbol: 'zFIX',
    decimals: 8,
    poolId: '281474976999999',
    scId: '0x000100000000ffff0000000000000001',
    shareTokenAddress: '0xf1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1',
    centrifugeVaultAddress: '0xfafafafafafafafafafafafafafafafafafafafa'
  }
};

/** The fixture's Centrifuge-vault address as query keys carry it — lowercased, like the key builder. */
export const FIXTURE_CENTRIFUGE_VAULT = FIXTURE_IDENTITY.shareClass.centrifugeVaultAddress.toLowerCase();
