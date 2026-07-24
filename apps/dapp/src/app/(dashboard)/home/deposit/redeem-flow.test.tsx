// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { formatUnits } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { USDC_ADDRESS, ZMCA_ADDRESS } = vi.hoisted(() => ({
  USDC_ADDRESS: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c',
  ZMCA_ADDRESS: '0xc0cE8aFcb1D3299A3445575EA426c1b313298B4c'
}));

const D18 = 10n ** 18n;

const mocks = vi.hoisted(() => ({
  claimRedeem: vi.fn(),
  claimableAssets: 0n,
  metricsIsError: false,
  metricsIsFetching: false,
  metricsRefetch: vi.fn(),
  pendingShares: 0n,
  requestRedeem: vi.fn(),
  sharePrice: 1_070000000000000000n,
  zMcaBalance: 10n * 10n ** 18n
}));

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@/centrifuge', () => ({
  CENTRIFUGE_CONFIG: {
    chainId: 11155111,
    shareToken: { address: ZMCA_ADDRESS, decimals: 18, symbol: 'zMCA' },
    usdc: { address: USDC_ADDRESS, decimals: 6 }
  },
  // Mirrors the module's unit math for the mocked 18/6 decimals above.
  sharesToUsdc: ({ shares, sharePrice }: { shares: bigint; sharePrice: bigint }) =>
    (shares * sharePrice) / 10n ** 18n / 10n ** 12n,
  useClaimRedeem: () => ({ isPending: false, isTxPending: false, mutate: mocks.claimRedeem }),
  useInvestment: () => ({
    isFetching: false,
    data: {
      pendingRedeemShares: mocks.pendingShares,
      claimableRedeemAssets: mocks.claimableAssets,
      claimableRedeemSharesEquivalent: 0n
    }
  }),
  useRequestRedeem: () => ({ isPending: false, isTxPending: false, mutate: mocks.requestRedeem })
}));
vi.mock('@/hooks/useCurrentShareMetrics', () => ({
  useCurrentShareMetrics: () => ({
    isPending: false,
    isError: mocks.metricsIsError,
    isFetching: mocks.metricsIsFetching,
    refetch: mocks.metricsRefetch,
    data: mocks.metricsIsError ? undefined : { sharePrice: mocks.sharePrice }
  })
}));
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));
vi.mock('@/hooks/useBalance', () => ({
  useBalance: ({ tokenAddress }: { tokenAddress: string }) => ({
    data: tokenAddress === ZMCA_ADDRESS ? mocks.zMcaBalance : 0n,
    isFetching: false,
    isPending: false
  })
}));
vi.mock('@/hooks/useChainalysis', () => ({ useChainalysis: () => ({ isFetching: false }) }));
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: vi.fn() }) }));
vi.mock('@/components/connected-account', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('./_components/input-extra-info', () => ({ InputExtraInfo: () => null }));
vi.mock('./_components/max-button', () => ({
  MaxButton: ({ balance, decimals, onPress }: { balance: bigint; decimals: number; onPress: (v: string) => void }) => (
    <button type="button" onClick={() => onPress(formatUnits(balance, decimals))}>
      Max
    </button>
  )
}));
vi.mock('./_components/token-display', () => ({ TokenDisplay: () => null }));
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({
    children,
    isDisabled,
    isPending,
    onPress,
    pendingContent
  }: {
    children?: ReactNode;
    isDisabled?: boolean;
    isPending?: boolean;
    onPress?: () => void;
    pendingContent?: ReactNode;
  }) => (
    <button type="button" disabled={isDisabled} onClick={onPress}>
      {isPending && pendingContent ? pendingContent : children}
    </button>
  )
}));
vi.mock('@zivoe/ui/core/input', () => ({
  Input: ({
    endContent,
    errorMessage,
    isDisabled,
    label,
    onChange,
    subContent,
    value
  }: {
    endContent?: ReactNode;
    errorMessage?: string;
    isDisabled?: boolean;
    label?: string;
    onChange?: (value: string) => void;
    subContent?: ReactNode;
    value?: string;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        disabled={isDisabled}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {endContent}
      {subContent}
      {errorMessage ? <span>{errorMessage}</span> : null}
    </label>
  )
}));
vi.mock('@zivoe/ui/core/skeleton', () => ({ Skeleton: () => <span>Loading preview</span> }));

import RedeemFlow from './redeem-flow';

function getInput(label: string): HTMLInputElement {
  const input = screen.getByLabelText(label);
  if (!(input instanceof HTMLInputElement)) throw new Error(`${label} is not an input`);
  return input;
}

function getButton(name: string): HTMLButtonElement {
  const button = screen.getByRole('button', { name });
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${name} is not a button`);
  return button;
}

describe('RedeemFlow', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimableAssets = 0n;
    mocks.metricsIsError = false;
    mocks.metricsIsFetching = false;
    mocks.pendingShares = 0n;
    mocks.sharePrice = 1_070000000000000000n;
  });

  it('requests the first redemption with a correctly scaled estimate and clears only on success', async () => {
    render(<RedeemFlow />);

    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    // 2 zMCA at a $1.07 Share Price → 2.14 USDC, in 6-decimal base units. An
    // 18-decimal USD value formatted as USDC would read in the trillions.
    expect(getInput('Estimated receive').value).toBe('2.14');

    await act(async () => {
      fireEvent.click(getButton('Request redemption'));
    });

    expect(mocks.requestRedeem).toHaveBeenCalledWith(
      { shares: 2n * D18, estimatedAssets: 2_140000n },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );

    // A failed request keeps the amount for a retry; success clears it. The
    // mutation resolves reverted receipts as success too — only a confirmed
    // receipt may clear the form.
    expect(getInput('Redeem').value).toBe('2');
    const options = mocks.requestRedeem.mock.calls[0]?.[1] as {
      onSuccess: (data: { receipt: { status: 'success' | 'reverted' } }) => void;
    };
    act(() => options.onSuccess({ receipt: { status: 'reverted' } }));
    expect(getInput('Redeem').value).toBe('2');
    act(() => options.onSuccess({ receipt: { status: 'success' } }));
    expect(getInput('Redeem').value).toBe('');
  });

  it('shows a retry action when the estimate fails and refetches on press', () => {
    mocks.metricsIsError = true;

    render(<RedeemFlow />);

    // Metrics are page-level, so the failure shows before any amount is typed.
    expect(screen.getByText(/Unable to estimate USDC/)).toBeTruthy();
    expect(getInput('Estimated receive').value).toBe('');
    expect(getButton('Request redemption').disabled).toBe(true);

    fireEvent.click(getButton('Retry'));
    expect(mocks.metricsRefetch).toHaveBeenCalledTimes(1);
  });

  it('drops back into the loading presentation while a retry is in flight', () => {
    mocks.metricsIsError = true;
    mocks.metricsIsFetching = true;

    render(<RedeemFlow />);
    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    expect(screen.queryByText(/Unable to estimate USDC/)).toBeNull();
    expect(getButton('Estimating USDC...')).toBeTruthy();
  });

  it('renders one aggregate pending position and adds to it without cancel controls', () => {
    mocks.pendingShares = 3n * D18;

    render(<RedeemFlow />);

    expect(screen.getByText(/3\.00 zMCA\s+processing\s+· ≈ 3\.21 USDC/)).toBeTruthy();
    expect(getButton('Add to redemption')).toBeTruthy();
    expect(screen.queryByText(/cancel/i)).toBeNull();
  });

  it('renders claimable proceeds first and claims all current partial fulfillments at once', () => {
    mocks.pendingShares = 1n * D18;
    mocks.claimableAssets = 2_000000n;

    render(<RedeemFlow />);

    expect(screen.getByText(/2\.00 USDC\s+ready to claim/)).toBeTruthy();

    fireEvent.click(getButton('Claim USDC'));
    expect(mocks.claimRedeem).toHaveBeenCalledWith({ claimableAssets: 2_000000n });
  });
});
