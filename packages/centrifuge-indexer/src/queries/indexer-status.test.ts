import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchIndexerChainStatuses } from '../index';
import { fakeIndexerResponse } from '../test-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchIndexerChainStatuses', () => {
  it('maps every well-formed chain entry by chain id and converts block timestamps to ms', async () => {
    fakeIndexerResponse({
      data: {
        _meta: {
          status: {
            ethereum: { id: 11155111, block: { number: 11503518, timestamp: 1786912620 } },
            base: { id: 84532, block: { number: 45572170, timestamp: 1786912628 } },
            malformed: { oops: true }
          }
        }
      }
    });

    const statuses = await fetchIndexerChainStatuses({ environment: 'testnet' });

    expect(statuses.get(11155111)).toEqual({ blockNumber: 11503518, lastIndexedAtMs: 1786912620000 });
    expect(statuses.get(84532)).toEqual({ blockNumber: 45572170, lastIndexedAtMs: 1786912628000 });
    // The malformed entry is skipped, not fatal — and an absent chain reads as stale downstream.
    expect(statuses.size).toBe(2);
  });

  it('returns an empty map when _meta is missing — unknown must read as stale', async () => {
    fakeIndexerResponse({ data: { _meta: null } });

    await expect(fetchIndexerChainStatuses({ environment: 'testnet' })).resolves.toEqual(new Map());
  });
});
