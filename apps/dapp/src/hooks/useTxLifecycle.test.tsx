// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { type TransactionReceipt } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type TransactionData, transactionAtom } from '@/lib/store';

import useTxLifecycle from './useTxLifecycle';

const captureException = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureException }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: vi.fn() }) }));
vi.mock('./useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));

const RECEIPT = { status: 'success', transactionHash: '0xabc' } as unknown as TransactionReceipt;

/** A minimal successful lifecycle run; the two riskiest behaviours override one hook each. */
function renderLifecycle(overrides: {
  transactionData?: (receipt: TransactionReceipt) => TransactionData;
  invalidate?: () => void;
}) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(
    () =>
      useTxLifecycle({
        pendingToast: () => 'pending',
        errorToast: () => 'error',
        sentryFlow: 'test-flow',
        zivoeVaultSlug: 'test-zivoe-vault',
        transactionData:
          overrides.transactionData ??
          ((receipt) => ({ type: 'SUCCESS', title: 'ok', description: 'ok', hash: receipt.transactionHash })),
        invalidate: overrides.invalidate ?? (() => undefined),
        prepare: () => ({}),
        send: async () => RECEIPT
      }),
    { wrapper }
  );
}

describe('useTxLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultStore().set(transactionAtom, undefined);
  });

  it('falls back to a minimal payload that still carries the ZivoeVault slug when payload construction throws', async () => {
    const rendered = renderLifecycle({
      transactionData: () => {
        throw new Error('payload boom');
      }
    });

    await act(async () => {
      rendered.result.current.mutate({});
    });
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    // A confirmed transaction is never re-classified, and the fallback shape
    // keeps the stamp the built payload would have carried.
    expect(getDefaultStore().get(transactionAtom)).toMatchObject({
      type: 'SUCCESS',
      title: 'Transaction Confirmed',
      zivoeVaultSlug: 'test-zivoe-vault'
    });
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ stage: 'payload', zivoeVault: 'test-zivoe-vault' }),
        extra: expect.objectContaining({ txHash: RECEIPT.transactionHash })
      })
    );
  });

  it('captures a throwing invalidation without re-classifying the settled transaction', async () => {
    const rendered = renderLifecycle({
      invalidate: () => {
        throw new Error('invalidate boom');
      }
    });

    await act(async () => {
      rendered.result.current.mutate({});
    });
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    expect(getDefaultStore().get(transactionAtom)).toMatchObject({ type: 'SUCCESS', title: 'ok' });
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ stage: 'invalidate', zivoeVault: 'test-zivoe-vault' }),
        extra: expect.objectContaining({ txHash: RECEIPT.transactionHash })
      })
    );
  });
});
