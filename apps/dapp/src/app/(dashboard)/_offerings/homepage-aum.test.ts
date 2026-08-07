import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHomepageAum } from './homepage-aum';

vi.mock('@zivoe/ui/icons', () => ({ ZMcaLogo: () => null }));
vi.mock('@/server/data/centrifuge-metrics', () => ({
  getShareClassNavs: vi.fn(),
  getCurrentShareMetrics: vi.fn()
}));

const { getCurrentShareMetrics, getShareClassNavs } = vi.mocked(
  await import('@/server/data/centrifuge-metrics'),
  true
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getHomepageAum', () => {
  it('sums the headline from the aggregated read and feeds each card its own entry', async () => {
    getShareClassNavs.mockResolvedValue({ zmca: '107000000000000000000' });

    await expect(getHomepageAum()).resolves.toEqual({
      headlineAum: 107,
      cardAums: { zmca: 107 }
    });
    expect(getCurrentShareMetrics).not.toHaveBeenCalled();
  });

  it('hides the headline for an empty book instead of rendering $0', async () => {
    getShareClassNavs.mockResolvedValue({});

    const { headlineAum } = await getHomepageAum();

    expect(headlineAum).toBeNull();
  });

  it('degrades cards to their own metrics read when the aggregated read fails, keeping the headline hidden', async () => {
    getShareClassNavs.mockResolvedValue(undefined);
    getCurrentShareMetrics.mockResolvedValue({
      sharePriceD18: '1070000000000000000',
      navD18: '107000000000000000000',
      apy: null,
      priceComputedAtMs: 0
    });

    await expect(getHomepageAum()).resolves.toEqual({
      headlineAum: null,
      cardAums: { zmca: 107 }
    });
    expect(getCurrentShareMetrics).toHaveBeenCalledWith('zmca');
  });

  it('renders the em-dash state when both the aggregate and the per-class fallback fail', async () => {
    getShareClassNavs.mockResolvedValue(undefined);
    getCurrentShareMetrics.mockResolvedValue(undefined);

    await expect(getHomepageAum()).resolves.toEqual({
      headlineAum: null,
      cardAums: { zmca: null }
    });
  });
});
