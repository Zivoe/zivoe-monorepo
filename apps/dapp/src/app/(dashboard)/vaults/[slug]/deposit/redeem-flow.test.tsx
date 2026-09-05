// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { formatUnits } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';
import { ZSMB_ZIVOE_VAULT, resolveTransactionIdentity } from '@/zivoe-vaults';

import { ZivoeVaultIdentityProvider } from '../zivoe-vault-provider';
import { EarnDialogProvider } from './_hooks/earn-dialog';
import RedeemFlow from './redeem-flow';

const { ZSMB_ADDRESS, BASE_SHARE_ADDRESS } = vi.hoisted(() => ({
  ZSMB_ADDRESS: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
  // The second chain's share token instance — distinct so a read against the
  // wrong chain's contract cannot pass by coincidence.
  BASE_SHARE_ADDRESS: '0xb2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
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
  requestRedeem: vi.fn(),
  returnedShares: 0n,
  sharePrice: 1_070000000000000000n,
  zSmbBalance: 10n * 10n ** 18n,
  // The second chain's wallet state, read only by the base-sepolia suites.
  baseShareBalance: 0n,
  baseClaimableAssets: 0n,
  basePendingShares: 0n,
  baseReturnedShares: 0n,
  walletChainId: 11155111,
  switchChain: vi.fn()
}));

const positionFor = vi.hoisted(
  () => (chain: string) =>
    chain === 'base-sepolia'
      ? {
          pendingRedeemShares: mocks.basePendingShares,
          claimableRedeemAssets: mocks.baseClaimableAssets,
          claimableRedeemSharesEquivalent: 0n,
          unfundedClaimableAssets: 0n,
          claimableCancelRedeemShares: mocks.baseReturnedShares,
          hasPendingCancelRedeemRequest: false
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
vi.mock('./_components/chain-token-selector', () => ({
  ChainTokenSelector: ({
    token,
    rows,
    onSelect,
    isDisabled
  }: {
    token: { label: string };
    rows: Array<{ chain: string; detail?: React.ReactNode }>;
    onSelect: (chain: never) => void;
    isDisabled?: boolean;
  }) => (
    <div>
      <span>Selector token: {token.label}</span>
      {rows.map((row) => (
        <div key={row.chain}>
          <button type="button" disabled={isDisabled} onClick={() => onSelect(row.chain as never)}>
            Select {row.chain}
          </button>
          {row.detail}
        </div>
      ))}
    </div>
  )
}));
vi.mock('@/centrifuge', () => ({
  // Mirrors the module's real unit math, including the share class's own
  // decimals — hardcoding 18 here once hid a scaling bug from this suite.
  sharesToUsdc: ({
    shares,
    sharePrice,
    shareClass
  }: {
    shares: bigint;
    sharePrice: bigint;
    shareClass: { decimals: number };
  }) => (shares * sharePrice) / 10n ** BigInt(shareClass.decimals) / 10n ** 12n,
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
  useRedemptionPosition: ({ centrifugeVault }: { centrifugeVault: { chain: string } }) => ({
    isError: mocks.positionIsError,
    isFetching: false,
    data: mocks.positionIsError ? undefined : positionFor(centrifugeVault.chain)
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
vi.mock('@/hooks/useBalance', () => ({
  useBalance: ({ tokenAddress }: { tokenAddress: string }) => ({
    data:
      tokenAddress === ZSMB_ADDRESS
        ? mocks.zSmbBalance
        : tokenAddress === BASE_SHARE_ADDRESS
          ? mocks.baseShareBalance
          : 0n,
    isFetching: false,
    isPending: false
  })
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
  mocks.returnedShares = 0n;
  mocks.sharePrice = 1_070000000000000000n;
  mocks.zSmbBalance = 10n * 10n ** 18n;
  mocks.baseShareBalance = 0n;
  mocks.baseClaimableAssets = 0n;
  mocks.basePendingShares = 0n;
  mocks.baseReturnedShares = 0n;
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

  it('still lets a wallet that is no longer whitelisted claim settled USDC while share moves are blocked', async () => {
    // The protocol exempts a redeem claim from the memberlist, so proceeds the
    // wallet is already owed must stay reachable. This is the assertion that
    // stops a future "block everything when not whitelisted" from stranding
    // funds.
    mocks.canReceiveShares = false;
    mocks.canRequestRedemption = false;
    mocks.claimableAssets = 150_000000n;
    mocks.pendingShares = 3n * D18;
    renderFlow();

    expect(getButton('Claim USDC').disabled).toBe(false);
    expect(getButton('Cancel request').disabled).toBe(true);
    expect(screen.getByText('Requires a whitelisted wallet.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(getButton('Claim USDC'));
    });

    expect(mocks.claimRedeem).toHaveBeenCalledWith({ claimableAssets: 150_000000n });
  });

  it('blocks cancelling and claiming returned shares for a wallet that cannot receive shares', async () => {
    // Both reduce on-chain to the same "may this wallet receive shares" check,
    // so neither may be offered while it answers no.
    mocks.canReceiveShares = false;
    mocks.returnedShares = 4n * D18;
    mocks.pendingShares = 3n * D18;
    renderFlow();

    await act(async () => {
      fireEvent.click(getButton('Claim zSMB'));
    });
    await act(async () => {
      fireEvent.click(getButton('Cancel request'));
    });

    expect(getButton('Claim zSMB').disabled).toBe(true);
    expect(getButton('Cancel request').disabled).toBe(true);
    expect(mocks.claimReturnedShares).not.toHaveBeenCalled();
    expect(mocks.cancelRedeem).not.toHaveBeenCalled();
    expect(screen.getAllByText('Requires a whitelisted wallet.').length).toBe(2);
    // The request form is untouched: this wallet may still send shares to
    // escrow, it just cannot get them back.
    expect(getInput('Redeem').disabled).toBe(false);
  });

  it('names a frozen wallet as frozen, down to the hints on the share controls', async () => {
    // Freeze and a missing admission produce identical verdicts on-chain, so
    // every surface that explains the block has to read the reason — the two
    // narrow hints included, since they sit far from the callout.
    mocks.canReceiveShares = false;
    mocks.canRequestRedemption = false;
    mocks.restriction = 'frozen';
    mocks.returnedShares = 4n * D18;
    mocks.pendingShares = 3n * D18;
    renderFlow();

    expect(getButton('Wallet Frozen').disabled).toBe(true);
    expect(screen.getByText(/This wallet is frozen on this chain/)).toBeTruthy();
    expect(screen.queryByText(/You must be whitelisted/)).toBeNull();
    expect(screen.getAllByText('This wallet is frozen.').length).toBe(2);
    expect(screen.queryByText('Requires a whitelisted wallet.')).toBeNull();
  });

  it('blocks a frozen wallet from claiming settled USDC, and says why', async () => {
    // Unlike membership, a freeze does gate a claim: the hook refuses every
    // transfer from a frozen wallet before it reaches the redeem-claim
    // exemption, so the router's claim would revert. The amount stays visible.
    mocks.canReceiveShares = false;
    mocks.canRequestRedemption = false;
    mocks.canClaimProceeds = false;
    mocks.restriction = 'frozen';
    mocks.claimableAssets = 150_000000n;
    renderFlow();

    // The headline must not contradict the disabled button: approved, not ready.
    expect(screen.getByText(/150\.00 USDC\s+approved/)).toBeTruthy();
    expect(screen.queryByText(/ready to claim/)).toBeNull();
    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.getByText('This wallet is frozen.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(getButton('Claim USDC'));
    });

    expect(mocks.claimRedeem).not.toHaveBeenCalled();
  });

  it('never calls an unexplained claim refusal "not whitelisted"', async () => {
    // Membership does not gate a claim, so the share controls' fallback copy
    // would be wrong here; the claim gets its own neutral line instead.
    mocks.canReceiveShares = false;
    mocks.canRequestRedemption = false;
    mocks.canClaimProceeds = false;
    mocks.restriction = 'unknown';
    mocks.claimableAssets = 150_000000n;
    renderFlow();

    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.getByText('This wallet cannot claim right now.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(getButton('Claim USDC'));
    });

    expect(mocks.claimRedeem).not.toHaveBeenCalled();
  });

  it("names a frozen wallet's Unfunded Claim and the freeze together", () => {
    // Two things stand between this wallet and its USDC; hiding the amount
    // (as the Centrifuge vault's permissioned view would) helps nobody.
    mocks.canReceiveShares = false;
    mocks.canRequestRedemption = false;
    mocks.canClaimProceeds = false;
    mocks.restriction = 'frozen';
    mocks.unfundedAssets = 310_071n;
    renderFlow();

    expect(screen.getByText(/0\.31 USDC\s+approved, awaiting liquidity on Ethereum/)).toBeTruthy();
    expect(screen.getByText('This wallet is frozen.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Claim USDC' })).toBeNull();
  });

  it('names the block instead of an impossible prerequisite in a blocked Split Outcome', () => {
    // A wallet that cannot receive shares cannot clear the Returned Shares
    // bucket, so "claim your returned shares first" would point at a step the
    // panel itself refuses. Its own claim is not blocked — membership never
    // gates it — but the SDK's aggregate claim makes it wait behind the same
    // bucket (see the button's gate); accepted until the SDK offers the USDC
    // claim alone.
    mocks.canReceiveShares = false;
    mocks.claimableAssets = 2_000000n;
    mocks.returnedShares = 1n * D18;
    renderFlow();

    expect(getButton('Claim zSMB').disabled).toBe(true);
    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.queryByText('Claim your returned zSMB first.')).toBeNull();
    expect(screen.getAllByText('Requires a whitelisted wallet.').length).toBe(2);
  });

  it('leaves share moves alone when only the redemption request is blocked', async () => {
    // The mirror case: a member who may not send shares to escrow can still
    // unwind a position it already has.
    mocks.canRequestRedemption = false;
    mocks.returnedShares = 4n * D18;
    mocks.pendingShares = 3n * D18;
    renderFlow();

    expect(getButton('Claim zSMB').disabled).toBe(false);
    expect(getButton('Cancel request').disabled).toBe(false);
    expect(screen.queryByText('Requires a whitelisted wallet.')).toBeNull();

    await act(async () => {
      fireEvent.click(getButton('Cancel request'));
    });

    expect(mocks.cancelRedeem).toHaveBeenCalledWith({ pendingShares: 3n * D18 });
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

  it('renders one aggregate pending position with a cancel control that cancels the full amount', () => {
    mocks.pendingShares = 3n * D18;

    renderFlow();

    expect(screen.getByText(/3\.00 zSMB\s+processing\s+· ≈ 3\.21 USDC/)).toBeTruthy();
    expect(getButton('Add to redemption')).toBeTruthy();

    fireEvent.click(getButton('Cancel request'));
    expect(mocks.cancelRedeem).toHaveBeenCalledWith({ pendingShares: 3n * D18 });
  });

  it('renders claimable proceeds first and claims all current partial fulfillments at once', () => {
    mocks.pendingShares = 1n * D18;
    mocks.claimableAssets = 2_000000n;

    renderFlow();

    expect(screen.getByText(/2\.00 USDC\s+ready to claim/)).toBeTruthy();

    fireEvent.click(getButton('Claim USDC'));
    expect(mocks.claimRedeem).toHaveBeenCalledWith({ claimableAssets: 2_000000n });
  });

  it('offers an exact 0.57 USDC claim without shedding a cent off the row', () => {
    mocks.claimableAssets = 570_000n;

    renderFlow();

    // The row and the post-claim receipt must agree on the same amount.
    expect(screen.getByText(/0\.57 USDC\s+ready to claim/)).toBeTruthy();
  });

  it('names an Unfunded Claim with its chain and offers no claim', () => {
    // Settled on-chain, but the chain's escrow cannot pay it: the SDK reports
    // nothing claimable, so without this strip the tab would show nothing at all.
    mocks.unfundedAssets = 310_071n;

    renderFlow();

    expect(screen.getByText(/0\.31 USDC\s+approved, awaiting liquidity on Ethereum/)).toBeTruthy();
    expect(screen.queryByText(/ready to claim/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Claim USDC' })).toBeNull();
    // Not a lock: the investor may still request more while operations fund the escrow.
    expect(getButton('Add to redemption').disabled).toBe(false);
  });

  it('locks the whole form during Cancellation Processing and hides the cancel control', () => {
    mocks.pendingShares = 3n * D18;
    mocks.hasPendingCancel = true;

    renderFlow();

    expect(screen.getByText(/Cancelling redemption request for 3\.00 zSMB/)).toBeTruthy();
    expect(screen.getByText(/available to claim once the cancellation is processed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();

    // A new request would revert on-chain (CancellationIsPending).
    expect(getInput('Redeem').disabled).toBe(true);
    expect(getButton('Cancellation in progress').disabled).toBe(true);
  });

  it('claims Returned Shares after a completed cancellation', () => {
    mocks.returnedShares = 3n * D18;

    renderFlow();

    expect(screen.getByText(/3\.00 zSMB\s+returned from cancellation/)).toBeTruthy();

    fireEvent.click(getButton('Claim zSMB'));
    expect(mocks.claimReturnedShares).toHaveBeenCalledWith({ returnedShares: 3n * D18 });

    // No cancellation in flight: the form stays open for a fresh request.
    expect(getInput('Redeem').disabled).toBe(false);
    expect(getButton('Request redemption')).toBeTruthy();
  });

  it('gates the USDC claim behind the Returned Shares claim in a Split Outcome', () => {
    mocks.claimableAssets = 2_000000n;
    mocks.returnedShares = 1n * D18;

    renderFlow();

    // The vault claims Returned Shares before USDC in one shared transaction
    // path, so the USDC button must wait its turn.
    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.getByText('Claim your returned zSMB first.')).toBeTruthy();
    expect(getButton('Claim zSMB').disabled).toBe(false);

    fireEvent.click(getButton('Claim zSMB'));
    expect(mocks.claimReturnedShares).toHaveBeenCalledWith({ returnedShares: 1n * D18 });
    expect(mocks.claimRedeem).not.toHaveBeenCalled();
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
    expect(screen.getByText('Selector token: zSMB')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(getInput('Redeem').value).toBe('10');
  });

  it("lists each chain's own share balance in the selector rows", () => {
    mocks.baseShareBalance = 25n * D18;
    renderTwoChainFlow();

    // Row details read each chain's own share-token instance — the one
    // signal that tells the user which chain actually holds their position.
    expect(screen.getByText('10.00')).toBeTruthy();
    expect(screen.getByText('25.00')).toBeTruthy();
  });

  it("selecting another chain shows that chain's position and gates writes behind the switch", async () => {
    mocks.baseClaimableAssets = 40_000000n;
    renderTwoChainFlow();

    // Selected sepolia: base-sepolia's claimable is not this view's business.
    expect(screen.queryByText(/USDC ready to claim/)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select base-sepolia' }));
    });

    // Selected base-sepolia: its claim strip renders, and — the wallet still
    // sitting on sepolia — every write is gated behind the network switch.
    expect(screen.getByText(/USDC ready to claim/)).toBeTruthy();
    expect(getButton('Claim USDC').disabled).toBe(true);

    await act(async () => {
      fireEvent.click(getButton('Switch to Base'));
    });
    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 84532 });
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

describe('RedeemFlow on a chain without redeem cancellation', () => {
  afterEach(cleanup);

  beforeEach(() => {
    resetMocks();
    // The wallet already sits on base-sepolia, so what follows tests the
    // controls themselves rather than the network-switch gate.
    mocks.walletChainId = 84532;
  });

  it('renders the pending position without a cancel control', () => {
    mocks.basePendingShares = 3n * D18;
    // Not even the whitelist verdict resurrects the control or its hint.
    mocks.canReceiveShares = false;

    renderFlow(BASE_IDENTITY);

    expect(screen.getByText(/3\.00 zSMB\s+processing/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
    expect(screen.queryByText('Requires a whitelisted wallet.')).toBeNull();

    // The rest of the tab is untouched: adding to the position stays offered.
    expect(getButton('Add to redemption')).toBeTruthy();
    expect(getInput('Redeem').disabled).toBe(false);
  });

  it('keeps returned-shares recovery and the USDC claim ordering data-driven', () => {
    // A cancellation made outside this dApp still resolves here — hiding the
    // Returned Shares claim would strand the USDC claim behind an invisible
    // prerequisite (the vault claims Returned Shares before USDC).
    mocks.baseReturnedShares = 1n * D18;
    mocks.baseClaimableAssets = 2_000000n;

    renderFlow(BASE_IDENTITY);

    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.getByText('Claim your returned zSMB first.')).toBeTruthy();

    fireEvent.click(getButton('Claim zSMB'));
    expect(mocks.claimReturnedShares).toHaveBeenCalledWith({ returnedShares: 1n * D18 });
  });
});
