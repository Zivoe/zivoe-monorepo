// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { formatUnits } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ZSMB_OFFERING, resolveTransactionIdentity } from '@/offerings';

import { OfferingIdentityProvider } from '../offering-provider';
import { EarnDialogProvider } from './_hooks/earn-dialog';
import { DepositFlow } from './deposit-flow';

const { USDC_ADDRESS, ROUTER_ADDRESS } = vi.hoisted(() => ({
  USDC_ADDRESS: '0x3aaaa86458d576BafCB1B7eD290434F0696dA65c',
  ZSMB_ADDRESS: '0xc0cE8aFcb1D3299A3445575EA426c1b313298B4c',
  ROUTER_ADDRESS: '0x792676c9B261B80BC3D7dD0f2D3A83d91A819BCD'
}));

// The zSMB identity exactly as the app resolves it — no hand-rolled copy to
// drift (an earlier fixture here carried the router address as the vault's).
const TEST_IDENTITY = resolveTransactionIdentity(ZSMB_OFFERING);

function renderFlow(status: 'Open' | 'Closed' = 'Open') {
  return render(
    <OfferingIdentityProvider identity={TEST_IDENTITY} status={status}>
      <EarnDialogProvider>
        <DepositFlow />
      </EarnDialogProvider>
    </OfferingIdentityProvider>
  );
}

const mocks = vi.hoisted(() => ({
  allowance: 0n,
  allowlistIsAllowed: true,
  allowlistIsError: false,
  approve: vi.fn(),
  capacity: 5_000000n,
  capacityIsError: false,
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
  CENTRIFUGE_ENV: {
    chainId: 11155111,
    vaultRouterAddress: ROUTER_ADDRESS,
    usdc: { address: USDC_ADDRESS, symbol: 'USDC', decimals: 6 }
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
  useInvestorAllowlist: () =>
    mocks.allowlistIsError
      ? { data: undefined, isError: true, isFetching: false, isSuccess: false }
      : {
          data: { canReceiveShares: mocks.allowlistIsAllowed, canRequestRedemption: mocks.allowlistIsAllowed },
          isError: false,
          isFetching: false,
          isSuccess: true
        },
  useVaultCapacity: () =>
    mocks.capacityIsError
      ? { data: undefined, isError: true, isFetching: false, isPending: false, isSuccess: false }
      : { data: { maxDeposit: mocks.capacity }, isError: false, isFetching: false, isPending: false, isSuccess: true }
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
vi.mock('@zivoe/ui/core/callout', () => ({
  Callout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));
vi.mock('@zivoe/ui/core/skeleton', () => ({ Skeleton: () => <span>Loading preview</span> }));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

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
    mocks.allowlistIsAllowed = true;
    mocks.allowlistIsError = false;
    mocks.capacity = 5_000000n;
    mocks.capacityIsError = false;
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
    renderFlow();

    enterAmount('2');

    expect(getInput('Estimated receive').value).toBe('');
    expect(screen.getAllByText('Loading preview').length).toBeGreaterThan(0);
    expect(getButton('Estimating zSMB...').disabled).toBe(true);
  });

  it('offers no deposit action at all on a closed Offering', () => {
    renderFlow('Closed');

    expect(getButton('Deposits Disabled').disabled).toBe(true);
    expect(screen.getByText('Deposits are currently disabled, redemptions are enabled.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deposit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    // Nothing to enter an amount for.
    expect(getInput('Deposit').disabled).toBe(true);
  });

  it('names the wallet and blocks the action when the vault does not admit it', async () => {
    mocks.allowlistIsAllowed = false;
    renderFlow();
    enterAmount('1');

    expect(getButton('Wallet Not Allowlisted').disabled).toBe(true);
    expect(screen.getByText(/You must be whitelisted to interact with this offer/)).toBeTruthy();
    expect(getInput('Deposit').disabled).toBe(true);

    await press('Wallet Not Allowlisted');

    expect(mocks.approve).not.toHaveBeenCalled();
    expect(mocks.deposit).not.toHaveBeenCalled();
  });

  it('leaves the action live on a failed allow-list read', async () => {
    // A fetch failure is not a verdict, so it neither names the wallet nor
    // takes the action away. The exact-call simulation is the authoritative
    // pre-sign gate and decodes the real revert if the vault does refuse.
    mocks.allowlistIsError = true;
    renderFlow();
    enterAmount('1');

    expect(getButton('Approve').disabled).toBe(false);
    expect(getInput('Deposit').disabled).toBe(false);
    expect(screen.queryByText(/You must be whitelisted/)).toBeNull();

    await press('Approve');

    expect(mocks.approve).toHaveBeenCalled();
  });

  it('drops the capacity cap rather than the action when the capacity read fails', async () => {
    // With no capacity there is nothing to validate against, so the cap simply
    // stops applying — 7 USDC clears a form that a successful 5 USDC read
    // would reject. ExceedsMaxDeposit still surfaces from the simulation.
    mocks.capacityIsError = true;

    renderFlow();
    // The resolver is async: without the await the message has not had a chance
    // to land, and asserting its absence would pass whatever the cap did.
    await act(async () => enterAmount('7'));

    expect(screen.queryByText(/exceeds current vault capacity/)).toBeNull();
    expect(getButton('Approve').disabled).toBe(false);
  });

  it('shows a retry action when the estimate fails and refetches on press', async () => {
    mocks.previewIsError = true;
    renderFlow();
    enterAmount('1');

    expect(getInput('Estimated receive').value).toBe('');
    expect(screen.getByText(/Unable to estimate zSMB/)).toBeTruthy();
    expect(getButton('Approve').disabled).toBe(true);

    await press('Retry');

    expect(mocks.previewRefetch).toHaveBeenCalledTimes(1);
  });

  it('drops back into the loading presentation while a retry is in flight', () => {
    mocks.previewIsError = true;
    mocks.previewIsFetching = true;
    renderFlow();
    enterAmount('1');

    expect(screen.queryByText(/Unable to estimate zSMB/)).toBeNull();
    expect(screen.getAllByText('Loading preview').length).toBeGreaterThan(0);
    expect(getButton('Estimating zSMB...').disabled).toBe(true);
  });

  it('shows the price-unavailable copy and still offers a retry', () => {
    mocks.previewIsError = true;
    mocks.previewError = 'price-unavailable';
    renderFlow();
    enterAmount('1');

    expect(screen.getByText('Deposits are currently unavailable.')).toBeTruthy();
    expect(getButton('Retry')).toBeTruthy();
    expect(getButton('Approve').disabled).toBe(true);
  });

  it('approves the exact USDC amount for the VaultRouter before exposing deposit', async () => {
    renderFlow();
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
    renderFlow();
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

  it('caps Max at vault capacity', () => {
    renderFlow();

    // Wallet holds 10 USDC but the vault only accepts 5 more.
    fireEvent.click(getButton('Max'));
    expect(getInput('Deposit').value).toBe('5');
  });

  it('offers no deposit action at all when the vault has no capacity', () => {
    // An Offering-level fact, so it reads like one: a named action and a
    // callout, not a validation error against an amount nobody has typed.
    mocks.capacity = 0n;
    renderFlow();

    expect(getButton('Deposits Unavailable').disabled).toBe(true);
    expect(screen.getByText('Deposits are currently unavailable, redemptions are enabled.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deposit' })).toBeNull();
    // Nothing to enter an amount for.
    expect(getInput('Deposit').disabled).toBe(true);
  });
});
