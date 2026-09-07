// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTIVE_CHAIN_IDS } from '@/lib/chains';

import { DynamicNetworkCacheRepair } from './dynamic-network-cache-repair';

const dynamicContext = vi.hoisted(() => ({
  networkConfigurations: undefined as { evm?: Array<{ chainId: number }> } | undefined,
  refetchProjectSettings: vi.fn()
}));

vi.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: () => dynamicContext
}));

// A stale cache is the full list minus one chain — drop the first.
const otherChainIds = ACTIVE_CHAIN_IDS.slice(1);

describe('DynamicNetworkCacheRepair', () => {
  beforeEach(() => {
    dynamicContext.refetchProjectSettings.mockReset().mockResolvedValue(undefined);
  });

  it('refetches once when the cached network list lacks an active chain', () => {
    dynamicContext.networkConfigurations = { evm: otherChainIds.map((chainId) => ({ chainId })) };

    const { rerender } = render(<DynamicNetworkCacheRepair />);
    rerender(<DynamicNetworkCacheRepair />);

    expect(dynamicContext.refetchProjectSettings).toHaveBeenCalledTimes(1);
  });

  it('does nothing when every active chain is cached', () => {
    dynamicContext.networkConfigurations = { evm: ACTIVE_CHAIN_IDS.map((chainId) => ({ chainId })) };

    render(<DynamicNetworkCacheRepair />);

    expect(dynamicContext.refetchProjectSettings).not.toHaveBeenCalled();
  });

  it('waits for the settings to load before judging the cache', () => {
    dynamicContext.networkConfigurations = {};

    render(<DynamicNetworkCacheRepair />);

    expect(dynamicContext.refetchProjectSettings).not.toHaveBeenCalled();
  });
});
