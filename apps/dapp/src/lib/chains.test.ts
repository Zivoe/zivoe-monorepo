import { describe, expect, it, vi } from 'vitest';

import { getChainId, waitForRpcCatchup } from './chains';

describe('waitForRpcCatchup', () => {
  const receiptBlock = 10n;

  it('resolves without any RPC call on chains that need no catch-up', async () => {
    const getBlockNumber = vi.fn();

    await waitForRpcCatchup({ client: { getBlockNumber }, chainId: getChainId('ethereum'), receiptBlock });

    expect(getBlockNumber).not.toHaveBeenCalled();
  });

  it('holds until the head passes the receipt block by the catch-up margin on Base', async () => {
    vi.useFakeTimers();
    try {
      // First head is the receipt's own block — a Flashblock preconfirmation
      // whose block has not sealed yet — and must keep holding.
      const getBlockNumber = vi.fn().mockResolvedValueOnce(10n).mockResolvedValue(11n);
      let settled = false;
      const wait = waitForRpcCatchup({ client: { getBlockNumber }, chainId: getChainId('base'), receiptBlock }).then(
        () => (settled = true)
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(250);
      await wait;
      expect(getBlockNumber).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds on Arbitrum too — fast blocks turn RPC replica lag into stale post-receipt reads', async () => {
    vi.useFakeTimers();
    try {
      // First head answers from a replica still behind the receipt's block.
      const getBlockNumber = vi.fn().mockResolvedValueOnce(9n).mockResolvedValue(11n);
      let settled = false;
      const wait = waitForRpcCatchup({
        client: { getBlockNumber },
        chainId: getChainId('arbitrum'),
        receiptBlock
      }).then(() => (settled = true));

      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(250);
      await wait;
      expect(getBlockNumber).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases on an RPC error instead of pinning the caller', async () => {
    const getBlockNumber = vi.fn().mockRejectedValue(new Error('rpc down'));

    await waitForRpcCatchup({ client: { getBlockNumber }, chainId: getChainId('base'), receiptBlock });

    expect(getBlockNumber).toHaveBeenCalledTimes(1);
  });

  it('gives up at the timeout when the RPC stays behind', async () => {
    vi.useFakeTimers();
    try {
      const getBlockNumber = vi.fn().mockResolvedValue(9n);
      let settled = false;
      void waitForRpcCatchup({ client: { getBlockNumber }, chainId: getChainId('base'), receiptBlock }).then(
        () => (settled = true)
      );

      await vi.advanceTimersByTimeAsync(8_000);
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
