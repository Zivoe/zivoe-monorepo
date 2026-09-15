// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { formatUnits } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';
import { ZSMB_ZIVOE_VAULT, resolveTransactionIdentity } from '@/zivoe-vaults';

import { ZivoeVaultIdentityProvider } from '../zivoe-vault-provider';
import type * as ChainTokenSelectorModule from './_components/chain-token-selector';
import { EarnDialogProvider } from './_hooks/earn-dialog';
import RedeemFlow from './redeem-flow';

const { ZSMB_ADDRESS, BASE_SHARE_ADDRESS, USDT_CENTRIFUGE_VAULT } = vi.hoisted(() => ({
  ZSMB_ADDRESS: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
  // The second chain's share token instance — distinct so a read against the
  // wrong chain's contract cannot pass by coincidence.
  BASE_SHARE_ADDRESS: '0xb2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2',
  // The first chain's SECOND Centrifuge vault — same share token, another stablecoin.
  USDT_CENTRIFUGE_VAULT: '0xc3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3'
}));

const D18 = 10n ** 18n;

// The zSMB identity exactly as the app resolves it — no hand-rolled copy to
// drift (an earlier fixture here used the share-token address as the vault's,
// the exact conflation the registry invariants exist to catch).
const TEST_IDENTITY = resolveTransactionIdentity(ZSMB_ZIVOE_VAULT, 'sepolia');

// The second chain's identity: same class, its own share-token and Centrifuge-vault
// instances — and, from the real chain config, no redeem cancellation.
const BASE_IDENTITY = identityOnChain(TEST_IDENTITY, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3',
  shareClass: { shareTokenAddress: BASE_SHARE_ADDRESS as `0x${string}` }
});

// The first chain's second Centrifuge vault: the same zSMB, paid out in an
// 18-decimal USDT — a different scale so a payout estimate formatted with the
// wrong vault's decimals cannot pass by coincidence.
const USDT_IDENTITY = identityOnChain(TEST_IDENTITY, 'sepolia', {
  address: USDT_CENTRIFUGE_VAULT as `0x${string}`,
  asset: { address: '0xf0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0', symbol: 'USDT', decimals: 18 }
});

// A fresh jotai store per render: the shared selected-chain atom must not
// leak a selection from one test into the next. The atom also persists to
// localStorage, which test/setup.ts clears after each test — store freshness
// alone no longer isolates the selection.
function renderFlow(identity = TEST_IDENTITY) {
  return render(
    <JotaiProvider>
      <ZivoeVaultIdentityProvider identities={[identity]} status="Open">
        <EarnDialogProvider>
          <RedeemFlow />
        </EarnDialogProvider>
      </ZivoeVaultIdentityProvider>
    </JotaiProvider>
  );
}

const mocks = vi.hoisted(() => ({
  // Kept apart on purpose: the panel gates different controls on each, so a
  // single "is whitelisted" switch could not express the states that matter.
  canReceiveShares: true,
  canRequestRedemption: true,
  canClaimProceeds: true,
  accessIsError: false,
  restriction: 'none',
  cancelRedeem: vi.fn(),
  claimRedeem: vi.fn(),
  claimReturnedShares: vi.fn(),
  claimableAssets: 0n,
  unfundedAssets: 0n,
  hasPendingCancel: false,
  metricsIsError: false,
  metricsIsFetching: false,
  metricsRefetch: vi.fn(),
  pendingShares: 0n,
  positionIsError: false,
  balanceIsError: false,
  refetchBalance: vi.fn(),
  requestRedeem: vi.fn(),
  returnedShares: 0n,
  sharePrice: 1_070000000000000000n,
  zSmbBalance: 10n * 10n ** 18n,
  // The second chain's wallet state, read only by the base-sepolia suites.
  baseShareBalance: 0n,
  baseClaimableAssets: 0n,
  basePendingShares: 0n,
  baseReturnedShares: 0n,
  // The USDT vault's position on the first chain, read only by the two-vault suite.
  usdtClaimableAssets: 0n,
  usdtPendingShares: 0n,
  usdtReturnedShares: 0n,
  usdtHasPendingCancel: false,
  walletChainId: 11155111,
  switchChain: vi.fn(),
  updateTab: vi.fn()
}));

// Positions are per Centrifuge vault: keyed by chain, then by vault address.
const positionFor = vi.hoisted(
  () =>
    ({ chain, address }: { chain: string; address: string }) =>
      chain === 'base-sepolia'
        ? {
            pendingRedeemShares: mocks.basePendingShares,
            claimableRedeemAssets: mocks.baseClaimableAssets,
            claimableRedeemSharesEquivalent: 0n,
            unfundedClaimableAssets: 0n,
            claimableCancelRedeemShares: mocks.baseReturnedShares,
            hasPendingCancelRedeemRequest: false
          }
        : address.toLowerCase() === USDT_CENTRIFUGE_VAULT
          ? {
              pendingRedeemShares: mocks.usdtPendingShares,
              claimableRedeemAssets: mocks.usdtClaimableAssets,
              claimableRedeemSharesEquivalent: 0n,
              unfundedClaimableAssets: 0n,
              claimableCancelRedeemShares: mocks.usdtReturnedShares,
              hasPendingCancelRedeemRequest: mocks.usdtHasPendingCancel
            }
          : {
              pendingRedeemShares: mocks.pendingShares,
              claimableRedeemAssets: mocks.claimableAssets,
              claimableRedeemSharesEquivalent: 0n,
              unfundedClaimableAssets: mocks.unfundedAssets,
              claimableCancelRedeemShares: mocks.returnedShares,
              hasPendingCancelRedeemRequest: mocks.hasPendingCancel
            }
);

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('./_hooks/useTabNavigation', () => ({
  useTabNavigation: () => ({ updateTab: mocks.updateTab, navigateToTab: vi.fn(), isMobile: false })
}));
// Pulled in by the Zivoe Vault modules' logos and the token display map.
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('wagmi', () => ({
  useConnection: () => ({ chainId: mocks.walletChainId }),
  useSwitchChain: () => ({ mutate: mocks.switchChain, isPending: false })
}));
// Reduced to its contract — one selectable row per chain, plus the token
// label the flow hands it — so the suite can drive selection without the
// dialog/select scaffolding. isDisabled must reach the row buttons: it is
// how this suite asserts the flow's selector gating (chain-agnostic locks
// only, never per-chain verdicts).
vi.mock('./_components/chain-token-selector', async (importOriginal) => ({
  // The pure row ordering stays real: it is what the balance-order assertions exercise.
  ...(await importOriginal<typeof ChainTokenSelectorModule>()),
  ChainTokenSelector: ({
    rows,
    onSelect,
    isDisabled
  }: {
    rows: Array<{ id: string; chain: string; token: { label: string }; detail?: React.ReactNode }>;
    onSelect: (id: string) => void;
    isDisabled?: boolean;
  }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id}>
          <span>Selector token: {row.token.label}</span>
          <button type="button" disabled={isDisabled} onClick={() => onSelect(row.id)}>
            Select {row.id}
          </button>
          {row.detail}
        </div>
      ))}
    </div>
  )
}));
vi.mock('@/centrifuge', () => ({
  // Mirrors the module's real unit math, including the share class's and
  // the deposit asset's own decimals — hardcoding either here once hid a
  // scaling bug from this suite.
  sharesToDepositAsset: ({
    shares,
    sharePrice,
    shareClass,
    asset
  }: {
    shares: bigint;
    sharePrice: bigint;
    shareClass: { decimals: number };
    asset: { decimals: number };
  }) => (shares * sharePrice * 10n ** BigInt(asset.decimals)) / 10n ** BigInt(shareClass.decimals) / 10n ** 18n,
  sharesToValueD18: ({
    shares,
    sharePrice,
    shareClass
  }: {
    shares: bigint;
    sharePrice: bigint;
    shareClass: { decimals: number };
  }) => (shares * sharePrice) / 10n ** BigInt(shareClass.decimals),
  useCancelRedeem: () => ({ isPending: false, isTxPending: false, mutate: mocks.cancelRedeem }),
  useClaimRedeem: () => ({ isPending: false, isTxPending: false, mutate: mocks.claimRedeem }),
  useClaimReturnedShares: () => ({ isPending: false, isTxPending: false, mutate: mocks.claimReturnedShares }),
  useInvestorAccess: () =>
    mocks.accessIsError
      ? { data: undefined, isError: true, isFetching: false, isSuccess: false }
      : {
          data: {
            canReceiveShares: mocks.canReceiveShares,
            canRequestRedemption: mocks.canRequestRedemption,
            canClaimProceeds: mocks.canClaimProceeds,
            restriction: mocks.restriction
          },
          isError: false,
          isFetching: false,
          isSuccess: true
        },
  useRedemptionPosition: ({ centrifugeVault }: { centrifugeVault: { chain: string; address: string } }) => ({
    isError: mocks.positionIsError,
    isFetching: false,
    data: mocks.positionIsError ? undefined : positionFor(centrifugeVault)
  }),
  useRequestRedeem: () => ({ isPending: false, isTxPending: false, mutate: mocks.requestRedeem })
}));
vi.mock('@/hooks/useCurrentShareMetrics', () => ({
  useCurrentShareMetrics: () => ({
    isPending: false,
    isError: mocks.metricsIsError,
    isFetching: mocks.metricsIsFetching,
    refetch: mocks.metricsRefetch,
    data: mocks.metricsIsError ? undefined : { sharePriceD18: mocks.sharePrice.toString() }
  })
}));
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));
const balanceOf = vi.hoisted(
  () => (tokenAddress: string) =>
    tokenAddress === ZSMB_ADDRESS
      ? mocks.zSmbBalance
      : tokenAddress === BASE_SHARE_ADDRESS
        ? mocks.baseShareBalance
        : 0n
);
vi.mock('@/hooks/useBalance', () => ({
  useBalance: ({ tokenAddress }: { tokenAddress: string }) => ({
    data: mocks.balanceIsError ? undefined : balanceOf(tokenAddress),
    isError: mocks.balanceIsError,
    isFetching: false,
    isPending: false,
    refetch: mocks.refetchBalance
  }),
  useTokenBalances: () => (token: { tokenAddress: string }) => balanceOf(token.tokenAddress)
}));
vi.mock('@/hooks/useChainalysis', () => ({ useChainalysis: () => ({ isFetching: false }) }));
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: vi.fn() }) }));
vi.mock('@/components/connected-account', () => ({ default: ({ children }: { children: ReactNode }) => children }));
// InputExtraInfo stays real: the dollar line's decimal scaling is exactly what
// this suite must be able to catch.
vi.mock('./_components/max-button', () => ({
  MaxButton: ({ balance, decimals, onPress }: { balance: bigint; decimals: number; onPress: (v: string) => void }) => (
    <button type="button" onClick={() => onPress(formatUnits(balance, decimals))}>
      Max
    </button>
  )
}));
vi.mock('./_components/token-display', () => ({ TokenDisplay: () => null }));
// Reduced to its contract: one button per payout asset on the chain.
vi.mock('./_components/payout-asset-selector', () => ({
  PayoutAssetSelector: ({
    identities,
    selected,
    onSelect,
    isDisabled
  }: {
    identities: Array<{ centrifugeVault: { address: string; asset: { symbol: string } } }>;
    selected: { centrifugeVault: { asset: { symbol: string } } };
    onSelect: (identity: never) => void;
    isDisabled?: boolean;
  }) => (
    <div>
      <span>Receive in: {selected.centrifugeVault.asset.symbol}</span>
      {identities.map((identity) => (
        <button
          key={identity.centrifugeVault.address}
          type="button"
          disabled={isDisabled}
          onClick={() => onSelect(identity as never)}
        >
          Receive {identity.centrifugeVault.asset.symbol}
        </button>
      ))}
    </div>
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
vi.mock('@zivoe/ui/core/callout', () => ({
  Callout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

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

/** One baseline for both suites — the mock surface is shared, so its reset must be too. */
function resetMocks() {
  vi.clearAllMocks();
  mocks.canReceiveShares = true;
  mocks.canRequestRedemption = true;
  mocks.canClaimProceeds = true;
  mocks.accessIsError = false;
  mocks.restriction = 'none';
  mocks.claimableAssets = 0n;
  mocks.unfundedAssets = 0n;
  mocks.hasPendingCancel = false;
  mocks.metricsIsError = false;
  mocks.metricsIsFetching = false;
  mocks.pendingShares = 0n;
  mocks.positionIsError = false;
  mocks.balanceIsError = false;
  mocks.returnedShares = 0n;
  mocks.sharePrice = 1_070000000000000000n;
  mocks.zSmbBalance = 10n * 10n ** 18n;
  mocks.baseShareBalance = 0n;
  mocks.baseClaimableAssets = 0n;
  mocks.basePendingShares = 0n;
  mocks.baseReturnedShares = 0n;
  mocks.usdtClaimableAssets = 0n;
  mocks.usdtPendingShares = 0n;
  mocks.usdtReturnedShares = 0n;
  mocks.usdtHasPendingCancel = false;
  mocks.walletChainId = 11155111;
}

describe('RedeemFlow', () => {
  afterEach(cleanup);

  beforeEach(resetMocks);

  it('names the wallet and blocks the request when the vault does not admit it', async () => {
    mocks.canRequestRedemption = false;
    renderFlow();

    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    expect(getButton('Wallet Not Whitelisted').disabled).toBe(true);
    expect(screen.getByText(/You must be whitelisted to interact with this vault/)).toBeTruthy();
    expect(getInput('Redeem').disabled).toBe(true);

    await act(async () => {
      fireEvent.click(getButton('Wallet Not Whitelisted'));
    });

    expect(mocks.requestRedeem).not.toHaveBeenCalled();
  });

  it('stacks both warnings below the main action', () => {
    mocks.canRequestRedemption = false;
    renderFlow();

    const action = getButton('Wallet Not Whitelisted');
    const processingWarning = screen.getByText(/Redemptions are processed periodically/);
    const whitelistWarning = screen.getByText(/You must be whitelisted to interact with this vault/);

    expect(action.compareDocumentPosition(processingWarning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(processingWarning.parentElement).toBe(whitelistWarning.parentElement);
    expect(processingWarning.parentElement?.className).toContain('flex-col');
  });

  it('leaves the request live on a failed access read', async () => {
    // A fetch failure is not a verdict, so it neither names the wallet nor
    // takes the action away. The exact-call simulation is the authoritative
    // pre-sign gate and decodes the real revert if the vault does refuse.
    mocks.accessIsError = true;
    renderFlow();

    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    expect(getButton('Request redemption').disabled).toBe(false);
    expect(getInput('Redeem').disabled).toBe(false);
    expect(screen.queryByText(/You must be whitelisted/)).toBeNull();

    await act(async () => {
      fireEvent.click(getButton('Request redemption'));
    });

    expect(mocks.requestRedeem).toHaveBeenCalled();
  });

  it('requests the first redemption with a correctly scaled estimate and clears only on success', async () => {
    renderFlow();

    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    // 2 zSMB at a $1.07 Share Price → 2.14 USDC, in 6-decimal base units. An
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

  it('withholds the request while the share balance read has failed, and retries it on press', async () => {
    mocks.balanceIsError = true;
    renderFlow();

    expect(screen.getByText(/Could not load your zSMB balance/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /redemption$/ })).toBeNull();

    await act(async () => {
      fireEvent.click(getButton('Retry'));
    });
    expect(mocks.refetchBalance).toHaveBeenCalledTimes(1);
  });

  it('leaves the request live while the position read is failing', async () => {
    // A failed read renders like "no position", but the one state it could be
    // hiding that makes a request invalid — a cancellation already in flight —
    // reverts at the simulation, which decodes CancellationIsPending.
    mocks.positionIsError = true;

    renderFlow();

    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    expect(getButton('Request redemption').disabled).toBe(false);

    await act(async () => {
      fireEvent.click(getButton('Request redemption'));
    });

    expect(mocks.requestRedeem).toHaveBeenCalled();
  });

  it('scales the dollar value independently of the share token decimals', () => {
    // The 8-decimals fixture: 2 shares at a $1.07 Share Price is ≈ $2.14 on
    // both rows. Formatting the redeem row's 18-decimal dollar value with the
    // share token's 8 decimals instead would read ≈ $21,400,000,000.140.
    renderFlow(FIXTURE_IDENTITY);

    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    expect(screen.getAllByText('≈ $2.140')).toHaveLength(2);
  });

  it('shows a retry action when the estimate fails and refetches on press', () => {
    mocks.metricsIsError = true;

    renderFlow();

    // Nothing to estimate yet, so nothing has failed yet.
    expect(screen.queryByText(/Unable to estimate USDC/)).toBeNull();

    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    expect(screen.getByText(/Unable to estimate USDC/)).toBeTruthy();
    expect(getInput('Estimated receive').value).toBe('');

    fireEvent.click(getButton('Retry'));
    expect(mocks.metricsRefetch).toHaveBeenCalledTimes(1);
  });

  it('still requests a redemption when the Share Price is unavailable', async () => {
    // The estimate is indicative — the request settles at the price applying
    // when it is processed — so an unreadable Share Price costs the receipt
    // its estimate and nothing else.
    mocks.metricsIsError = true;

    renderFlow();
    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    expect(getButton('Request redemption').disabled).toBe(false);

    await act(async () => {
      fireEvent.click(getButton('Request redemption'));
    });

    expect(mocks.requestRedeem).toHaveBeenCalledWith(
      { shares: 2n * D18, estimatedAssets: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('drops back into the loading presentation while a retry is in flight', () => {
    mocks.metricsIsError = true;
    mocks.metricsIsFetching = true;

    renderFlow();
    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });

    // The skeleton belongs to the estimate row; the request stays offered.
    expect(screen.queryByText(/Unable to estimate USDC/)).toBeNull();
    expect(screen.getAllByText('Loading preview').length).toBeGreaterThan(0);
    expect(getButton('Request redemption').disabled).toBe(false);
  });

  it('locks the form during Cancellation Processing and says why, linking to the Requests tab', () => {
    mocks.pendingShares = 3n * D18;
    mocks.hasPendingCancel = true;

    renderFlow();

    // A new request would revert on-chain (CancellationIsPending).
    expect(getInput('Redeem').disabled).toBe(true);
    expect(getButton('Cancellation in progress').disabled).toBe(true);
    expect(
      screen.getByText(/New redemption requests into USDC on Ethereum are paused while a cancellation is processed/)
    ).toBeTruthy();
    expect(screen.queryByText(/Cancelling redemption request/)).toBeNull();

    fireEvent.click(getButton('View requests'));
    expect(mocks.updateTab).toHaveBeenCalledWith('requests');
  });

  it('keeps every position off the form — the Requests tab holds them', () => {
    mocks.pendingShares = 3n * D18;
    mocks.claimableAssets = 2_000000n;
    mocks.returnedShares = 1n * D18;

    renderFlow();

    expect(screen.queryByText(/processing/)).toBeNull();
    expect(screen.queryByText(/ready to claim/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Claim/ })).toBeNull();
    // A position in the payout vault still turns the request into an addition.
    expect(getButton('Add to redemption')).toBeTruthy();
  });
});

describe('RedeemFlow across two chains', () => {
  afterEach(cleanup);

  beforeEach(resetMocks);

  function renderTwoChainFlow() {
    return render(
      <JotaiProvider>
        <ZivoeVaultIdentityProvider identities={[TEST_IDENTITY, BASE_IDENTITY]} status="Open">
          <EarnDialogProvider>
            <RedeemFlow />
          </EarnDialogProvider>
        </ZivoeVaultIdentityProvider>
      </JotaiProvider>
    );
  }

  it('defaults to the first chain regardless of where the position sits', () => {
    // Shares are chain-local: base-sepolia holds more, but the tab opens on
    // the first selector item and shows that chain's values only.
    mocks.baseShareBalance = 25n * D18;
    renderTwoChainFlow();

    // The selector offers the SHARE token's chain instances — "zSMB on X" is
    // the position being redeemed; the USDC side is a plain display.
    expect(screen.getAllByText('Selector token: zSMB')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(getInput('Redeem').value).toBe('10');
  });

  it("lists each chain's own share balance in the selector rows, the larger holding first", () => {
    mocks.baseShareBalance = 25n * D18;
    renderTwoChainFlow();

    // Row details read each chain's own share-token instance — the one
    // signal that tells the user which chain actually holds their position —
    // and the chain holding more comes first.
    expect(screen.getByText('10.00')).toBeTruthy();
    expect(screen.getByText('25.00')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Select / }).map((row) => row.textContent)).toEqual([
      'Select base-sepolia',
      'Select sepolia'
    ]);
  });

  it("selecting another chain binds the form to that chain's vault and gates the request behind the switch", async () => {
    mocks.basePendingShares = 3n * D18;
    renderTwoChainFlow();

    expect(getButton('Request redemption')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select base-sepolia' }));
    });

    // Selected base-sepolia — the wallet still sitting on sepolia — the main
    // action is the switch.
    await act(async () => {
      fireEvent.click(getButton('Switch to Base'));
    });
    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 84532 });

    // Once the wallet is there, the pending request in Base's vault makes the
    // request an addition — the form is bound to that chain's vault.
    cleanup();
    mocks.walletChainId = 84532;
    renderTwoChainFlow();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select base-sepolia' }));
    });
    expect(getButton('Add to redemption')).toBeTruthy();
  });

  it('keeps the chain selector usable when the selected chain blocks redemptions', async () => {
    // Not-whitelisted locks the form, but it is a verdict about the SELECTED
    // chain — switching away is the escape, so the selector must not inherit
    // the form lock (chain-agnostic locks only; the rule lives on
    // useSelectedChain's doc).
    mocks.canRequestRedemption = false;
    renderTwoChainFlow();

    const rowButton = screen.getByRole('button', { name: 'Select base-sepolia' });
    expect((rowButton as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(rowButton);
    });

    // The selection moved: the wallet still sits on sepolia, so the switch
    // CTA takes over the main action.
    expect(getButton('Switch to Base')).toBeTruthy();
  });
});

describe('RedeemFlow with two stablecoins on one chain', () => {
  afterEach(cleanup);

  beforeEach(resetMocks);

  function renderTwoVaultFlow() {
    return render(
      <JotaiProvider>
        <ZivoeVaultIdentityProvider identities={[TEST_IDENTITY, USDT_IDENTITY]} status="Open">
          <EarnDialogProvider>
            <RedeemFlow />
          </EarnDialogProvider>
        </ZivoeVaultIdentityProvider>
      </JotaiProvider>
    );
  }

  it("opens on the chain's default coin and re-scales the estimate to the chosen payout asset", async () => {
    renderTwoVaultFlow();

    expect(screen.getByText('Receive in: USDC')).toBeTruthy();
    fireEvent.change(getInput('Redeem'), { target: { value: '2' } });
    expect(getInput('Estimated receive').value).toBe('2.14');
    expect(screen.getByText(/Your final USDC amount/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(getButton('Receive USDT'));
    });

    // Same share balance, same chain, no network switch — only the payout changes.
    expect(screen.getByText('Receive in: USDT')).toBeTruthy();
    expect(getInput('Estimated receive').value).toBe('2.14');
    expect(screen.getByText(/Your final USDT amount/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
    expect(getButton('Request redemption').disabled).toBe(false);
  });

  it('locks the form for a Cancellation Processing in the payout vault only', async () => {
    mocks.pendingShares = 3n * D18;
    mocks.hasPendingCancel = true;
    renderTwoVaultFlow();

    // Paying out in USDC, whose vault is mid-unwind: a new request would revert.
    expect(screen.getByText(/New redemption requests into USDC on Ethereum are paused/)).toBeTruthy();
    expect(getInput('Redeem').disabled).toBe(true);
    expect(getButton('Cancellation in progress').disabled).toBe(true);

    await act(async () => {
      fireEvent.click(getButton('Receive USDT'));
    });

    // The USDT vault is untouched, so a request into it stays open, and the
    // banner about the USDC vault leaves with it.
    expect(getInput('Redeem').disabled).toBe(false);
    expect(getButton('Request redemption').disabled).toBe(false);
    expect(screen.queryByText(/requests into USDC on Ethereum are paused/)).toBeNull();
  });

  it('says "Add to redemption" only when the PAYOUT vault already holds a request', async () => {
    mocks.pendingShares = 3n * D18;
    renderTwoVaultFlow();

    expect(getButton('Add to redemption')).toBeTruthy();

    await act(async () => {
      fireEvent.click(getButton('Receive USDT'));
    });

    // The USDT vault has nothing to add to.
    expect(getButton('Request redemption')).toBeTruthy();
  });
});
