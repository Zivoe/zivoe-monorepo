// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pendingTxCountAtom } from '@/lib/store';

import { OTHER_WRITE_PENDING_LABEL } from '@/hooks/useIsAnyTxPending';

import { type InvestorAccess } from '@/centrifuge';
import { identityOnChain } from '@/test/fixtures';
import { ZSMB_ZIVOE_VAULT, resolveTransactionIdentity } from '@/zivoe-vaults';

import {
  type RedeemAccessGates,
  RedemptionPositionStrips,
  deriveRedeemAccessGates
} from './redemption-position-strips';

const D18 = 10n ** 18n;

// The zSMB identity exactly as the app resolves it; sepolia supports cancellation.
const TEST_IDENTITY = resolveTransactionIdentity(ZSMB_ZIVOE_VAULT, 'sepolia');
// The second chain: from the real chain config, no redeem cancellation.
const BASE_IDENTITY = identityOnChain(TEST_IDENTITY, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3'
});

const mocks = vi.hoisted(() => ({
  cancelRedeem: vi.fn(),
  claimRedeem: vi.fn(),
  claimReturnedShares: vi.fn(),
  claimableAssets: 0n,
  unfundedAssets: 0n,
  hasPendingCancel: false,
  pendingShares: 0n,
  returnedShares: 0n,
  positionIsFetching: false
}));

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@/centrifuge', () => ({
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
  useCancelRedeem: () => ({ isPending: false, isTxPending: false, mutate: mocks.cancelRedeem }),
  useClaimRedeem: () => ({ isPending: false, isTxPending: false, mutate: mocks.claimRedeem }),
  useClaimReturnedShares: () => ({ isPending: false, isTxPending: false, mutate: mocks.claimReturnedShares }),
  useRedemptionPosition: () => ({
    isError: false,
    isFetching: mocks.positionIsFetching,
    data: {
      pendingRedeemShares: mocks.pendingShares,
      claimableRedeemAssets: mocks.claimableAssets,
      claimableRedeemSharesEquivalent: 0n,
      unfundedClaimableAssets: mocks.unfundedAssets,
      claimableCancelRedeemShares: mocks.returnedShares,
      hasPendingCancelRedeemRequest: mocks.hasPendingCancel
    }
  })
}));
vi.mock('@/components/connected-account', () => ({ default: ({ children }: { children: ReactNode }) => children }));
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

/** Gates for a wallet the hook admits everywhere, overridable per verdict. */
function gatesFor(overrides: Partial<InvestorAccess> = {}): RedeemAccessGates {
  return deriveRedeemAccessGates({
    isSuccess: true,
    data: {
      canReceiveShares: true,
      canRequestRedemption: true,
      canClaimProceeds: true,
      restriction: 'none',
      ...overrides
    }
  });
}

function renderStrips({
  identity = TEST_IDENTITY,
  gates = gatesFor(),
  isWriteBlocked = false,
  switchChain,
  labelAsset = false
}: {
  identity?: typeof TEST_IDENTITY;
  gates?: RedeemAccessGates;
  isWriteBlocked?: boolean;
  switchChain?: { label: string; onPress: () => void };
  labelAsset?: boolean;
} = {}) {
  return render(
    <RedemptionPositionStrips
      identity={identity}
      labelAsset={labelAsset}
      gates={gates}
      sharePrice={1_070000000000000000n}
      isWriteBlocked={isWriteBlocked}
      switchChain={switchChain}
      onSuccessClose={vi.fn()}
    />
  );
}

function getButton(name: string): HTMLButtonElement {
  const button = screen.getByRole('button', { name });
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${name} is not a button`);
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimableAssets = 0n;
  mocks.unfundedAssets = 0n;
  mocks.hasPendingCancel = false;
  mocks.pendingShares = 0n;
  mocks.returnedShares = 0n;
  mocks.positionIsFetching = false;
});

afterEach(cleanup);

describe('RedemptionPositionStrips', () => {
  it('renders one aggregate pending position with a cancel control that cancels the full amount', () => {
    mocks.pendingShares = 3n * D18;
    renderStrips();

    expect(screen.getByText(/3\.00 zSMB\s+processing\s+· ≈ 3\.21 USDC/)).toBeTruthy();
    fireEvent.click(getButton('Cancel request'));
    expect(mocks.cancelRedeem).toHaveBeenCalledWith({ pendingShares: 3n * D18 });
  });

  it('renders claimable proceeds and claims all current partial fulfillments at once', () => {
    mocks.pendingShares = 1n * D18;
    mocks.claimableAssets = 2_000000n;
    renderStrips();

    expect(screen.getByText(/2\.00 USDC\s+ready to claim/)).toBeTruthy();
    fireEvent.click(getButton('Claim USDC'));
    expect(mocks.claimRedeem).toHaveBeenCalledWith({ claimableAssets: 2_000000n });
  });

  it('offers an exact 0.57 USDC claim without shedding a cent off the row', () => {
    mocks.claimableAssets = 570_000n;
    renderStrips();

    // The row and the post-claim receipt must agree on the same amount.
    expect(screen.getByText(/0\.57 USDC\s+ready to claim/)).toBeTruthy();
  });

  it('names an Unfunded Claim with its chain and offers no claim', () => {
    mocks.unfundedAssets = 310_071n;
    renderStrips();

    expect(screen.getByText(/0\.31 USDC\s+approved, awaiting liquidity on Ethereum/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Claim USDC' })).toBeNull();
  });

  it('shows Cancellation Processing without a cancel control', () => {
    mocks.pendingShares = 3n * D18;
    mocks.hasPendingCancel = true;
    renderStrips();

    expect(screen.getByText(/Cancelling redemption request for 3\.00 zSMB/)).toBeTruthy();
    expect(screen.getByText(/available to claim once the cancellation is processed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
  });

  it('claims Returned Shares after a completed cancellation', () => {
    mocks.returnedShares = 3n * D18;
    renderStrips();

    expect(screen.getByText(/3\.00 zSMB\s+returned from cancellation/)).toBeTruthy();
    fireEvent.click(getButton('Claim zSMB'));
    expect(mocks.claimReturnedShares).toHaveBeenCalledWith({ returnedShares: 3n * D18 });
  });

  it('gates the USDC claim behind the Returned Shares claim in a Split Outcome', () => {
    mocks.claimableAssets = 2_000000n;
    mocks.returnedShares = 1n * D18;
    renderStrips();

    // The vault claims Returned Shares before USDC in one shared transaction
    // path, so the USDC button must wait its turn.
    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.getByText('Claim your returned zSMB first.')).toBeTruthy();
    expect(getButton('Claim zSMB').disabled).toBe(false);
  });

  it('still lets a wallet that is no longer whitelisted claim settled USDC while share moves are blocked', () => {
    // The protocol exempts a redeem claim from the memberlist, so proceeds the
    // wallet is already owed must stay reachable. This is the assertion that
    // stops a future "block everything when not whitelisted" from stranding funds.
    mocks.claimableAssets = 150_000000n;
    mocks.pendingShares = 3n * D18;
    renderStrips({ gates: gatesFor({ canReceiveShares: false, canRequestRedemption: false }) });

    expect(getButton('Claim USDC').disabled).toBe(false);
    expect(getButton('Cancel request').disabled).toBe(true);
    expect(screen.getByText('Requires a whitelisted wallet.')).toBeTruthy();
  });

  it('blocks cancelling and claiming returned shares for a wallet that cannot receive shares', () => {
    mocks.returnedShares = 4n * D18;
    mocks.pendingShares = 3n * D18;
    renderStrips({ gates: gatesFor({ canReceiveShares: false }) });

    expect(getButton('Claim zSMB').disabled).toBe(true);
    expect(getButton('Cancel request').disabled).toBe(true);
    expect(screen.getAllByText('Requires a whitelisted wallet.')).toHaveLength(2);
  });

  it('names a frozen wallet as frozen on every hint, and blocks its settled USDC claim', () => {
    mocks.returnedShares = 4n * D18;
    mocks.pendingShares = 3n * D18;
    mocks.claimableAssets = 150_000000n;
    renderStrips({
      gates: gatesFor({
        canReceiveShares: false,
        canRequestRedemption: false,
        canClaimProceeds: false,
        restriction: 'frozen'
      })
    });

    // The headline must not contradict the disabled button: approved, not ready.
    expect(screen.getByText(/150\.00 USDC\s+approved/)).toBeTruthy();
    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.getAllByText('This wallet is frozen.')).toHaveLength(3);
    expect(screen.queryByText('Requires a whitelisted wallet.')).toBeNull();
  });

  it('never calls an unexplained claim refusal "not whitelisted"', () => {
    mocks.claimableAssets = 150_000000n;
    renderStrips({
      gates: gatesFor({
        canReceiveShares: false,
        canRequestRedemption: false,
        canClaimProceeds: false,
        restriction: 'unknown'
      })
    });

    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.getByText('This wallet cannot claim right now.')).toBeTruthy();
  });

  it("names a frozen wallet's Unfunded Claim and the freeze together", () => {
    mocks.unfundedAssets = 310_071n;
    renderStrips({
      gates: gatesFor({
        canReceiveShares: false,
        canRequestRedemption: false,
        canClaimProceeds: false,
        restriction: 'frozen'
      })
    });

    expect(screen.getByText(/0\.31 USDC\s+approved, awaiting liquidity on Ethereum/)).toBeTruthy();
    expect(screen.getByText('This wallet is frozen.')).toBeTruthy();
  });

  it('names the block instead of an impossible prerequisite in a blocked Split Outcome', () => {
    mocks.claimableAssets = 2_000000n;
    mocks.returnedShares = 1n * D18;
    renderStrips({ gates: gatesFor({ canReceiveShares: false }) });

    expect(getButton('Claim zSMB').disabled).toBe(true);
    expect(getButton('Claim USDC').disabled).toBe(true);
    expect(screen.queryByText('Claim your returned zSMB first.')).toBeNull();
    expect(screen.getAllByText('Requires a whitelisted wallet.')).toHaveLength(2);
  });

  it('renders the pending position without a cancel control on a chain without redeem cancellation', () => {
    mocks.pendingShares = 3n * D18;
    renderStrips({ identity: BASE_IDENTITY, gates: gatesFor({ canReceiveShares: false }) });

    expect(screen.getByText(/3\.00 zSMB\s+processing/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
    expect(screen.queryByText('Requires a whitelisted wallet.')).toBeNull();
  });

  it('offers the network switch in place of every action while the wallet sits on another chain', () => {
    mocks.claimableAssets = 2_000000n;
    mocks.returnedShares = 1n * D18;
    mocks.pendingShares = 3n * D18;
    const onPress = vi.fn();
    renderStrips({ switchChain: { label: 'Switch to Ethereum', onPress } });

    const switches = screen.getAllByRole('button', { name: 'Switch to Ethereum' });
    expect(switches).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Claim USDC' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();

    fireEvent.click(switches[0]!);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mocks.claimReturnedShares).not.toHaveBeenCalled();
  });

  it('waits out a write started anywhere else — the lifecycle-owned count locks every control', () => {
    mocks.claimableAssets = 2_000000n;
    mocks.returnedShares = 1n * D18;
    mocks.pendingShares = 3n * D18;
    // A request signing on the redeem tab, or a claim on another chain's
    // strips: the lifecycle counts it wherever it started.
    getDefaultStore().set(pendingTxCountAtom, 1);
    try {
      renderStrips();
      // Every control waits, and says why — the hook that started the write
      // may have unmounted with its tab, so none of them can claim it.
      const waiting = screen.getAllByRole('button', { name: OTHER_WRITE_PENDING_LABEL });
      expect(waiting).toHaveLength(3);
      expect(waiting.every((button) => button instanceof HTMLButtonElement && button.disabled)).toBe(true);
      expect(screen.queryByRole('button', { name: 'Claim USDC' })).toBeNull();
    } finally {
      getDefaultStore().set(pendingTxCountAtom, 0);
    }
  });

  it('keeps its controls locked while prerequisites load or its own position refetches', async () => {
    mocks.claimableAssets = 2_000000n;
    const { rerender } = renderStrips({ isWriteBlocked: true });
    expect(getButton('Claim USDC').disabled).toBe(true);

    mocks.positionIsFetching = true;
    await act(async () => {
      rerender(
        <RedemptionPositionStrips
          identity={TEST_IDENTITY}
          labelAsset={false}
          gates={gatesFor()}
          sharePrice={1_070000000000000000n}
          isWriteBlocked={false}
          onSuccessClose={vi.fn()}
        />
      );
    });
    expect(getButton('Claim USDC').disabled).toBe(true);
  });

  it('labels every strip with the coin only where asked', () => {
    mocks.pendingShares = 3n * D18;
    mocks.returnedShares = 1n * D18;
    renderStrips({ labelAsset: true });
    expect(screen.getAllByText('USDC redemption')).toHaveLength(2);

    cleanup();
    renderStrips({ labelAsset: false });
    expect(screen.queryByText('USDC redemption')).toBeNull();
  });
});
