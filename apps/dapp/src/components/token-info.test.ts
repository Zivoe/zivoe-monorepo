import { describe, expect, it, vi } from 'vitest';

// The Offering modules' logos enter through the registry import.
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

import { getTokenInfo } from './token-info';

describe('getTokenInfo', () => {
  it('rejects prototype-chain symbols instead of returning Object.prototype members', () => {
    for (const symbol of ['toString', '__proto__', 'constructor', 'valueOf']) {
      expect(getTokenInfo(symbol)).toBeUndefined();
    }
  });

  it('resolves the deposit asset and stays undefined for unknown symbols', () => {
    expect(getTokenInfo('USDC')?.label).toBe('USDC');
    expect(getTokenInfo('zNOPE')).toBeUndefined();
  });
});
