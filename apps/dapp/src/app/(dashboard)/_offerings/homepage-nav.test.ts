import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHomepageNav } from './homepage-nav';

// The registry is mocked wholesale: these tests assert aggregation semantics
// and must never enumerate the live book — registering an Offering broke the
// old real-registry assertions once.
vi.mock('@/offerings', () => ({
  OFFERINGS: [{ shareClass: { key: 'alpha' } }, { shareClass: { key: 'beta' } }]
}));
vi.mock('@/server/data/centrifuge-metrics', () => ({
  getShareClassNavs: vi.fn(),
  getCurrentShareMetrics: vi.fn()
}));

const { getCurrentShareMetrics, getShareClassNavs } = vi.mocked(await import('@/server/data/centrifuge-metrics'), true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getHomepageNav', () => {
  it('sums the headline from the aggregated read and feeds each card its own entry', async () => {
    getShareClassNavs.mockResolvedValue({
      alpha: '107000000000000000000',
      beta: '53000000000000000000'
    });

    await expect(getHomepageNav()).resolves.toEqual({
      headlineNav: 160,
      cardNavs: { alpha: 107, beta: 53 }
    });
    expect(getCurrentShareMetrics).not.toHaveBeenCalled();
  });

  it('hides the headline for an empty book instead of rendering $0', async () => {
    getShareClassNavs.mockResolvedValue({});

    const { headlineNav } = await getHomepageNav();

    expect(headlineNav).toBeNull();
  });

  it('degrades cards to their own metrics read when the aggregated read fails, keeping the headline hidden', async () => {
    getShareClassNavs.mockResolvedValue(undefined);
    getCurrentShareMetrics.mockResolvedValue({
      sharePriceD18: '1070000000000000000',
      navD18: '107000000000000000000',
      apy: null,
      priceComputedAtMs: 0
    });

    await expect(getHomepageNav()).resolves.toEqual({
      headlineNav: null,
      cardNavs: { alpha: 107, beta: 107 }
    });
    expect(getCurrentShareMetrics.mock.calls.map((call) => call[0])).toEqual(['alpha', 'beta']);
  });

  it('renders the em-dash state when both the aggregate and the per-class fallback fail', async () => {
    getShareClassNavs.mockResolvedValue(undefined);
    getCurrentShareMetrics.mockResolvedValue(undefined);

    await expect(getHomepageNav()).resolves.toEqual({
      headlineNav: null,
      cardNavs: { alpha: null, beta: null }
    });
  });
});
