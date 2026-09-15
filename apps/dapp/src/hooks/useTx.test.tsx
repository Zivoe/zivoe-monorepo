// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type TransactionReceipt } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useTx, { type TxParams } from './useTx';

const mocks = vi.hoisted(() => ({
  simulateContract: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn()
}));

vi.mock('wagmi', () => ({
  useConfig: () => ({}),
  useWriteContract: () => ({ mutateAsync: mocks.writeContract })
}));
vi.mock('wagmi/actions', () => ({
  getPublicClient: () => ({
    simulateContract: mocks.simulateContract,
    waitForTransactionReceipt: mocks.waitForTransactionReceipt
  })
}));
vi.mock('@/lib/chains', () => ({
  chainOfChainId: () => undefined,
  getViemChain: () => ({ nativeCurrency: { symbol: 'ETH', decimals: 18 } }),
  waitForRpcCatchup: async () => undefined
}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('sonner', () => ({ toast: { dismiss: vi.fn() } }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(() => 1), Toaster: () => null }));
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: vi.fn() }) }));
vi.mock('./useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));

const ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  }
] as const;
type Params = TxParams<typeof ABI, 'approve'>;

const SPENDER = '0x1111111111111111111111111111111111111111';
const params = (amount: bigint): Params => ({
  abi: ABI,
  address: '0x2222222222222222222222222222222222222222',
  functionName: 'approve',
  args: [SPENDER, amount],
  chainId: 1
});
const receipt = (hash: string, status: 'success' | 'reverted' = 'success') =>
  ({ status, transactionHash: hash, logs: [], blockNumber: 1n }) as unknown as TransactionReceipt;

/** A mutation whose reset is decided by the variable, with everything else minimal. */
function renderTx() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const invalidate = vi.fn();

  const rendered = renderHook(
    () =>
      useTx<{ amount: bigint; reset: boolean }, Params>({
        buildParams: ({ amount }) => params(amount),
        reset: {
          buildParams: ({ reset }) => (reset ? params(0n) : undefined),
          pendingToast: () => 'resetting'
        },
        pendingToast: () => 'pending',
        errorToast: () => 'error',
        sentryFlow: 'test-flow',
        transactionData: (receipt) => ({
          type: 'SUCCESS',
          title: 'ok',
          description: 'ok',
          hash: receipt.transactionHash
        }),
        invalidate
      }),
    { wrapper }
  );

  return { ...rendered, invalidate };
}

describe('useTx reset step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.simulateContract.mockResolvedValue({});
  });

  it('simulates, sends and confirms the reset before the main transaction', async () => {
    mocks.writeContract.mockResolvedValueOnce('0xreset').mockResolvedValueOnce('0xmain');
    mocks.waitForTransactionReceipt.mockImplementation(async ({ hash }: { hash: string }) => receipt(hash));

    const rendered = renderTx();
    await act(async () => rendered.result.current.mutate({ amount: 5n, reset: true }));
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    // Both calls go through the full path, reset first, and the receipt of
    // the reset is waited for before the main approve is even simulated.
    expect(mocks.writeContract.mock.calls.map(([p]) => p.args)).toEqual([
      [SPENDER, 0n],
      [SPENDER, 5n]
    ]);
    expect(mocks.simulateContract).toHaveBeenCalledTimes(2);
    expect(mocks.waitForTransactionReceipt.mock.calls.map(([p]) => p.hash)).toEqual(['0xreset', '0xmain']);
    const [resetReceiptOrder] = mocks.waitForTransactionReceipt.mock.invocationCallOrder;
    expect(mocks.simulateContract.mock.invocationCallOrder[1]).toBeGreaterThan(resetReceiptOrder ?? Infinity);
  });

  it('stops before the main transaction when the reset reverts', async () => {
    mocks.writeContract.mockResolvedValueOnce('0xreset');
    mocks.waitForTransactionReceipt.mockResolvedValueOnce(receipt('0xreset', 'reverted'));

    const rendered = renderTx();
    await act(async () => rendered.result.current.mutate({ amount: 5n, reset: true }));
    await waitFor(() => expect(rendered.result.current.isError).toBe(true));

    expect(mocks.writeContract).toHaveBeenCalledTimes(1);
  });

  it('refetches after a confirmed reset when the wallet rejects the main transaction', async () => {
    mocks.writeContract.mockResolvedValueOnce('0xreset').mockRejectedValueOnce(new Error('User rejected the request'));
    mocks.waitForTransactionReceipt.mockResolvedValueOnce(receipt('0xreset'));

    const rendered = renderTx();
    await act(async () => rendered.result.current.mutate({ amount: 5n, reset: true }));
    await waitFor(() => expect(rendered.result.current.isError).toBe(true));

    // The reset moved the allowance on-chain before the rejection, so the
    // caches must not keep the pre-reset value a plain rejection would leave.
    expect(mocks.writeContract).toHaveBeenCalledTimes(2);
    expect(rendered.invalidate).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when the wallet rejects a transaction nothing preceded', async () => {
    mocks.writeContract.mockRejectedValueOnce(new Error('User rejected the request'));

    const rendered = renderTx();
    await act(async () => rendered.result.current.mutate({ amount: 5n, reset: false }));
    await waitFor(() => expect(rendered.result.current.isError).toBe(true));

    expect(rendered.invalidate).not.toHaveBeenCalled();
  });

  it('sends only the main transaction when no reset is due', async () => {
    mocks.writeContract.mockResolvedValueOnce('0xmain');
    mocks.waitForTransactionReceipt.mockResolvedValueOnce(receipt('0xmain'));

    const rendered = renderTx();
    await act(async () => rendered.result.current.mutate({ amount: 5n, reset: false }));
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));

    expect(mocks.writeContract).toHaveBeenCalledTimes(1);
    expect(mocks.writeContract.mock.calls[0]?.[0].args).toEqual([SPENDER, 5n]);
  });
});
