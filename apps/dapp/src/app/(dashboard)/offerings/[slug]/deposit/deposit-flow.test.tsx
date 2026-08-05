// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { formatUnits } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DepositFlow } from './deposit-flow';

const { USDC_ADDRESS, ZMCA_ADDRESS, ROUTER_ADDRESS } = vi.hoisted(() => ({
  USDC_ADDRESS: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c',
  ZMCA_ADDRESS: '0xc0cE8aFcb1D3299A3445575EA426c1b313298B4c',
  ROUTER_ADDRESS: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD'
}));

const mocks = vi.hoisted(() => ({
  allowance: 0n,
  approve: vi.fn(),
  capacity: 5_000000n,
  deposit: vi.fn(),
  isDebouncing: false,
  previewError: undefined as string | undefined,
  previewIsError: false,
  previewIsFetching: false,
  previewRefetch: vi.fn(),
  previewShares: 1_230000000000000000n,
  staleDebouncedValue: undefined as string | undefined,
  usdcBalance: 10_000000n
}));

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@/centrifuge', () => ({
  CENTRIFUGE_CONFIG: {
    chainId: 11155111,
    vaultRouterAddress: ROUTER_ADDRESS,
    shareToken: { address: ZMCA_ADDRESS, decimals: 18, symbol: 'zMCA' },
    usdc: { address: USDC_ADDRESS, decimals: 6 }
  },
  useDeposit: () => ({ isPending: false, isTxPending: false, mutate: mocks.deposit }),
  useDepositPreview: ({ assets }: { assets: bigint }) => ({
    data: assets > 0n && !mocks.previewIsError ? { shares: mocks.previewShares } : undefined,
    error: mocks.previewError,
    isError: mocks.previewIsError,
    isFetching: mocks.previewIsFetching,
    refetch: mocks.previewRefetch
  }),
  isPriceUnavailableError: (error: unknown) => error === 'price-unavailable',
  useVaultCapacity: () => ({
    data: { maxDeposit: mocks.capacity },
    isFetching: false,
    isPending: false,
    isSuccess: true
  })
}));
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));
vi.mock('@/hooks/useAllowance', () => ({
  checkHasEnoughAllowance: ({ allowance, amount }: { allowance?: bigint; amount?: bigint }) =>
    allowance !== undefined && amount !== undefined && allowance >= amount,
  useAllowance: () => ({ data: mocks.allowance, isFetching: false })
}));
vi.mock('@/hooks/useApproveSpending', () => ({
  useApproveSpending: () => ({ isPending: false, isTxPending: false, mutate: mocks.approve })
}));
vi.mock('@/hooks/useBalance', () => ({
  useBalance: ({ tokenAddress }: { tokenAddress: string }) => ({
    data: tokenAddress === USDC_ADDRESS ? mocks.usdcBalance : 0n,
    isFetching: false,
    isPending: false
  })
}));
vi.mock('@/hooks/useChainalysis', () => ({ useChainalysis: () => ({ isFetching: false }) }));
vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: ({ value }: { value: string }) => ({
    debouncedValue: mocks.staleDebouncedValue ?? value,
    isDebouncing: mocks.isDebouncing
  })
}));
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: vi.fn() }) }));
vi.mock('@/components/connected-account', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/token-info', () => ({ TOKEN_INFO: { USDC: { icon: <span /> } } }));
vi.mock('./_components/input-extra-info', () => ({ InputExtraInfo: () => null }));
vi.mock('./_components/max-button', () => ({
  MaxButton: ({ balance, decimals, onPress }: { balance: bigint; decimals: number; onPress: (v: string) => void }) => (
    <button type="button" onClick={() => onPress(formatUnits(balance, decimals))}>
      Max
    </button>
  )
}));
vi.mock('./_components/token-display', () => ({ TokenDisplay: () => null }));
vi.mock('react-aria-components', () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  )
}));
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
    startContent,
    subContent,
    value
  }: {
    endContent?: ReactNode;
    errorMessage?: ReactNode;
    isDisabled?: boolean;
    label?: string;
    onChange?: (value: string) => void;
    startContent?: ReactNode;
    subContent?: ReactNode;
    value?: string;
  }) => (
    <label>
      {label}
      {startContent}
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
vi.mock('@zivoe/ui/core/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode | ((input: { close: () => void }) => ReactNode) }) => (
    <div>{typeof children === 'function' ? children({ close: vi.fn() }) : children}</div>
  ),
  DialogContentBox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));
vi.mock('@zivoe/ui/core/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectListBox: ({ children }: { children: ReactNode | ((item: never) => ReactNode) }) => (
    <div>{typeof children === 'function' ? null : children}</div>
  ),
  SelectPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null
}));
vi.mock('@zivoe/ui/core/skeleton', () => ({ Skeleton: () => <span>Loading preview</span> }));
vi.mock('@zivoe/ui/icons', () => ({ UsdcIcon: () => null, InfoIcon: () => null }));

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

function enterAmount(value: string) {
  fireEvent.change(getInput('Deposit'), { target: { value } });
}

async function press(name: string) {
  await act(async () => {
    fireEvent.click(getButton(name));
  });
}

describe('DepositFlow', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowance = 0n;
    mocks.capacity = 5_000000n;
    mocks.isDebouncing = false;
    mocks.previewError = undefined;
    mocks.previewIsError = false;
    mocks.previewIsFetching = false;
    mocks.staleDebouncedValue = undefined;
    mocks.usdcBalance = 10_000000n;
  });

  it('never renders or enables an old quote during the debounce window', () => {
    // Typed 2 while the debounced value still says 1 — the stale quote and
    // Approve must not surface.
    mocks.isDebouncing = true;
    mocks.staleDebouncedValue = '1';
    render(<DepositFlow />);

    enterAmount('2');

    expect(getInput('Estimated receive').value).toBe('');
    expect(screen.getAllByText('Loading preview').length).toBeGreaterThan(0);
    expect(getButton('Estimating zMCA...').disabled).toBe(true);
  });

  it('shows a retry action when the estimate fails and refetches on press', async () => {
    mocks.previewIsError = true;
    render(<DepositFlow />);
    enterAmount('1');

    expect(getInput('Estimated receive').value).toBe('');
    expect(screen.getByText(/Unable to estimate zMCA/)).toBeTruthy();
    expect(getButton('Approve').disabled).toBe(true);

    await press('Retry');

    expect(mocks.previewRefetch).toHaveBeenCalledTimes(1);
  });

  it('drops back into the loading presentation while a retry is in flight', () => {
    mocks.previewIsError = true;
    mocks.previewIsFetching = true;
    render(<DepositFlow />);
    enterAmount('1');

    expect(screen.queryByText(/Unable to estimate zMCA/)).toBeNull();
    expect(screen.getAllByText('Loading preview').length).toBeGreaterThan(0);
    expect(getButton('Estimating zMCA...').disabled).toBe(true);
  });

  it('shows the price-unavailable copy and still offers a retry', () => {
    mocks.previewIsError = true;
    mocks.previewError = 'price-unavailable';
    render(<DepositFlow />);
    enterAmount('1');

    expect(screen.getByText('Deposits are currently unavailable.')).toBeTruthy();
    expect(getButton('Retry')).toBeTruthy();
    expect(getButton('Approve').disabled).toBe(true);
  });

  it('approves the exact USDC amount for the VaultRouter before exposing deposit', async () => {
    render(<DepositFlow />);
    enterAmount('1');

    expect(getInput('Estimated receive').value).toBe('1.23');

    await press('Approve');

    expect(mocks.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        contract: USDC_ADDRESS,
        spender: ROUTER_ADDRESS,
        amount: 1_000000n,
        name: 'USDC',
        successMessage: 'You can now deposit USDC.'
      })
    );
    expect(mocks.deposit).not.toHaveBeenCalled();
  });

  it('deposits with the current quote, keeps failures retryable, and clears only on success', async () => {
    mocks.allowance = 2_000000n;
    render(<DepositFlow />);
    enterAmount('1');

    await press('Deposit');

    expect(mocks.deposit).toHaveBeenCalledWith(
      { assets: 1_000000n, previewShares: mocks.previewShares },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );

    // A failed transaction leaves the amount in place for a retry. The
    // mutation resolves reverted receipts as success too — only a confirmed
    // receipt may clear the form.
    expect(getInput('Deposit').value).toBe('1');

    const options = mocks.deposit.mock.calls[0]?.[1] as {
      onSuccess: (data: { receipt: { status: 'success' | 'reverted' } }) => void;
    };
    act(() => options.onSuccess({ receipt: { status: 'reverted' } }));
    expect(getInput('Deposit').value).toBe('1');
    act(() => options.onSuccess({ receipt: { status: 'success' } }));
    expect(getInput('Deposit').value).toBe('');
  });

  it('caps Max at vault capacity and disables zero-capacity deposits', () => {
    const { rerender } = render(<DepositFlow />);

    // Wallet holds 10 USDC but the vault only accepts 5 more.
    fireEvent.click(getButton('Max'));
    expect(getInput('Deposit').value).toBe('5');

    mocks.capacity = 0n;
    rerender(<DepositFlow />);
    expect(screen.getByText('Deposits are currently unavailable.')).toBeTruthy();
    expect(getButton('Approve').disabled).toBe(true);
  });
});
