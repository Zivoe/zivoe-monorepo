// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { SHARE_CLASSES, assertUnique } from '@zivoe/centrifuge-indexer';

import { DEPOSIT_TOKENS } from '@/types/constants';

import { REGISTERED_ZIVOE_VAULTS, ZIVOE_VAULTS, resolveZivoeVaultIdentities } from './index';

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

/**
 * Data lint over the Zivoe Vault registry, run by the dApp test suite (the
 * repo has no CI — running `pnpm test` before a deploy is the gate):
 * registering a new Zivoe Vault either works end to end or fails the suite
 * loudly. Key/module agreement and "one module per catalog entry" are
 * compile-time (see REGISTERED_ZIVOE_VAULTS); catalog identity uniqueness is
 * the shared package's own import-time lint.
 */
describe('Zivoe Vault registry', () => {
  const zivoeVaults = Object.values(REGISTERED_ZIVOE_VAULTS);

  it('gives every Zivoe Vault a unique slug, compared case-insensitively', () => {
    // Lowercased like the on-chain identities: two slugs differing only in
    // case would read identically to a user while exact-match routing leaves
    // one of them unreachable.
    expect(() =>
      assertUnique({
        values: zivoeVaults.map((zivoeVault) => zivoeVault.slug.toLowerCase()),
        message: (slug) => `Duplicate Zivoe Vault slug "${slug}".`
      })
    ).not.toThrow();
  });

  it('keeps every slug kebab-case — it is a permanent public URL segment', () => {
    // Concatenated unencoded into routes, emails and external links —
    // anything beyond kebab-case would encode or normalize differently
    // across those surfaces.
    for (const zivoeVault of zivoeVaults) expect(zivoeVault.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('never lets a share class claim a deposit asset symbol', () => {
    // The share-token display map spreads over the deposit-token map, so a
    // share class claiming a deposit asset's symbol would silently take over
    // that asset's display entry.
    for (const zivoeVault of zivoeVaults) {
      const symbol = SHARE_CLASSES[zivoeVault.shareClass.key].symbol.toLowerCase();
      expect(DEPOSIT_TOKENS.map((token) => token.toLowerCase())).not.toContain(symbol);
    }
  });

  it('serves at least one Zivoe Vault on the test deployment, resolvable on every live chain', () => {
    expect(ZIVOE_VAULTS.length).toBeGreaterThan(0);

    for (const zivoeVault of ZIVOE_VAULTS) {
      const identities = resolveZivoeVaultIdentities(zivoeVault);
      expect(identities.length).toBeGreaterThan(0);
      for (const identity of identities) {
        expect(identity.zivoeVaultSlug).toBe(zivoeVault.slug);
        expect(identity.centrifugeVault.shareClass.key).toBe(zivoeVault.shareClass.key);
      }
    }
  });
});
