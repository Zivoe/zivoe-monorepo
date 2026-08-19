// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { formatUnits } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';
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

// A fresh jotai store per render: the shared selected-chain atom must not
// leak a selection from one test into the next.
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
  whitelistIsError: false,
  cancelRedeem: vi.fn(),
  claimRedeem: vi.fn(),
  claimReturnedShares: vi.fn(),
  claimableAssets: 0n,
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
  // The second chain's wallet state, read only by the two-chain suite.
  baseShareBalance: 0n,
  baseClaimableAssets: 0n,
  walletChainId: 11155111,
  switchChain: vi.fn()
}));

const positionFor = vi.hoisted(
  () => (chain: string) =>
    chain === 'base-sepolia'
      ? {
          pendingRedeemShares: 0n,
          claimableRedeemAssets: mocks.baseClaimableAssets,
          claimableRedeemSharesEquivalent: 0n,
          claimableCancelRedeemShares: 0n,
          hasPendingCancelRedeemRequest: false
        }
      : {
          pendingRedeemShares: mocks.pendingShares,
          claimableRedeemAssets: mocks.claimableAssets,
          claimableRedeemSharesEquivalent: 0n,
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
// dialog/select scaffolding.
vi.mock('./_components/chain-token-selector', () => ({
  ChainTokenSelector: ({
    token,
    rows,
    onSelect
  }: {
    token: { label: string };
    rows: Array<{ chain: string }>;
    onSelect: (chain: never) => void;
  }) => (
    <div>
      <span>Selector token: {token.label}</span>
      {rows.map((row) => (
        <button type="button" key={row.chain} onClick={() => onSelect(row.chain as never)}>
          Select {row.chain}
        </button>
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
  useInvestorWhitelist: () =>
    mocks.whitelistIsError
      ? { data: undefined, isError: true, isFetching: false, isSuccess: false }
      : {
          data: { canReceiveShares: mocks.canReceiveShares, canRequestRedemption: mocks.canRequestRedemption },
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

describe('RedeemFlow', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canReceiveShares = true;
    mocks.canRequestRedemption = true;
    mocks.whitelistIsError = false;
    mocks.claimableAssets = 0n;
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
    mocks.walletChainId = 11155111;
  });

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
    // The protocol exempts a redeem claim from the whitelist, so proceeds the
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

  it('leaves the request live on a failed whitelist read', async () => {
    // A fetch failure is not a verdict, so it neither names the wallet nor
    // takes the action away. The exact-call simulation is the authoritative
    // pre-sign gate and decodes the real revert if the vault does refuse.
    mocks.whitelistIsError = true;
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

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canReceiveShares = true;
    mocks.canRequestRedemption = true;
    mocks.whitelistIsError = false;
    mocks.claimableAssets = 0n;
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
    mocks.walletChainId = 11155111;
  });

  // The second chain's identity: same class, its own share-token and Centrifuge-vault instances.
  const BASE_IDENTITY = {
    ...TEST_IDENTITY,
    centrifugeVault: {
      ...TEST_IDENTITY.centrifugeVault,
      chain: 'base-sepolia' as const,
      chainId: 84532,
      address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3' as const,
      shareClass: {
        ...TEST_IDENTITY.centrifugeVault.shareClass,
        shareTokenAddress: BASE_SHARE_ADDRESS as `0x${string}`
      }
    }
  };

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
});
