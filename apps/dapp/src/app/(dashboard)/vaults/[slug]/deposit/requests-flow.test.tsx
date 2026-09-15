// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type RedemptionPosition, type TransactionIdentity } from '@/centrifuge';
import { identityOnChain } from '@/test/fixtures';
import { ZSMB_ZIVOE_VAULT, resolveTransactionIdentity } from '@/zivoe-vaults';

import { ZivoeVaultIdentityProvider } from '../zivoe-vault-provider';
import { EarnDialogProvider } from './_hooks/earn-dialog';
import { countRedemptionRequests } from './_hooks/use-redemption-requests';
import RequestsFlow from './requests-flow';

const D18 = 10n ** 18n;

const SEPOLIA_USDC = resolveTransactionIdentity(ZSMB_ZIVOE_VAULT, 'sepolia');
const SEPOLIA_USDT = identityOnChain(SEPOLIA_USDC, 'sepolia', {
  address: '0xc3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',
  asset: { address: '0xf0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0', symbol: 'USDT', decimals: 6 }
});
const BASE_USDC = identityOnChain(SEPOLIA_USDC, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3'
});

const EMPTY: RedemptionPosition = {
  pendingRedeemShares: 0n,
  claimableRedeemAssets: 0n,
  claimableRedeemSharesEquivalent: 0n,
  unfundedClaimableAssets: 0n,
  claimableCancelRedeemShares: 0n,
  hasPendingCancelRedeemRequest: false
};

type RequestMocks = {
  address: string | undefined;
  walletChainId: number;
  switchChain: ReturnType<typeof vi.fn>;
  claimRedeem: ReturnType<typeof vi.fn>;
  cancelRedeem: ReturnType<typeof vi.fn>;
  claimReturnedShares: ReturnType<typeof vi.fn>;
  /** Position per Centrifuge-vault address (lowercase); absent means "empty". */
  positions: Record<string, Partial<RedemptionPosition>>;
  failing: Set<string>;
  /** Set to model the first read still in flight on every vault. */
  isPending: boolean;
  /** Vault addresses (lowercase) whose first read is still in flight. */
  pending: Set<string>;
  /** Set to model the wallet SDK not having settled yet. */
  isAccountPending: boolean;
};

const mocks = vi.hoisted(
  (): RequestMocks => ({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    walletChainId: 11155111,
    switchChain: vi.fn(),
    claimRedeem: vi.fn(),
    cancelRedeem: vi.fn(),
    claimReturnedShares: vi.fn(),
    positions: {},
    failing: new Set<string>(),
    isPending: false,
    pending: new Set<string>(),
    isAccountPending: false
  })
);

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('wagmi', () => ({
  useConnection: () => ({ chainId: mocks.walletChainId }),
  useSwitchChain: () => ({ mutate: mocks.switchChain, isPending: false })
}));
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({
    isPending: mocks.isAccountPending,
    isDisconnected: !mocks.isAccountPending && !mocks.address,
    address: mocks.isAccountPending ? undefined : mocks.address
  })
}));
vi.mock('@/hooks/useChainalysis', () => ({ useChainalysis: () => ({ isFetching: false }) }));
vi.mock('@/hooks/useCurrentShareMetrics', () => ({
  useCurrentShareMetrics: () => ({ isPending: false, isError: false, data: { sharePriceD18: '1070000000000000000' } })
}));
vi.mock('@/components/connected-account', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children ?? 'Connect Wallet'}</div>
}));
vi.mock('@/centrifuge', () => {
  const positionOf = (address: string) => {
    const key = address.toLowerCase();
    return mocks.failing.has(key) ? undefined : { ...EMPTY_POSITION, ...mocks.positions[key] };
  };
  const EMPTY_POSITION = {
    pendingRedeemShares: 0n,
    claimableRedeemAssets: 0n,
    claimableRedeemSharesEquivalent: 0n,
    unfundedClaimableAssets: 0n,
    claimableCancelRedeemShares: 0n,
    hasPendingCancelRedeemRequest: false
  };
  return {
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
    useInvestorAccess: () => ({
      isSuccess: true,
      isFetching: false,
      data: { canReceiveShares: true, canRequestRedemption: true, canClaimProceeds: true, restriction: 'none' }
    }),
    useRedemptionPosition: ({ centrifugeVault }: { centrifugeVault: { address: string } }) => ({
      isError: mocks.failing.has(centrifugeVault.address.toLowerCase()),
      isFetching: false,
      data: positionOf(centrifugeVault.address)
    }),
    useRedemptionPositions: ({ centrifugeVaults }: { centrifugeVaults: Array<{ address: string }> }) =>
      centrifugeVaults.map((centrifugeVault) => {
        const isPending = mocks.isPending || mocks.pending.has(centrifugeVault.address.toLowerCase());
        return {
          isError: mocks.failing.has(centrifugeVault.address.toLowerCase()),
          isPending,
          data: isPending ? undefined : positionOf(centrifugeVault.address)
        };
      }),
    // Each write records the vault it was built for: a strip acting on the
    // tab's selected identity instead of its own would call the wrong vault.
    useCancelRedeem: ({ identity }: { identity: TransactionIdentity }) => ({
      isPending: false,
      isTxPending: false,
      mutate: (vars: object) => mocks.cancelRedeem({ ...vars, centrifugeVault: identity.centrifugeVault.address })
    }),
    useClaimRedeem: ({ identity }: { identity: TransactionIdentity }) => ({
      isPending: false,
      isTxPending: false,
      mutate: (vars: object) => mocks.claimRedeem({ ...vars, centrifugeVault: identity.centrifugeVault.address })
    }),
    useClaimReturnedShares: ({ identity }: { identity: TransactionIdentity }) => ({
      isPending: false,
      isTxPending: false,
      mutate: (vars: object) =>
        mocks.claimReturnedShares({ ...vars, centrifugeVault: identity.centrifugeVault.address })
    })
  };
});
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({ children, isDisabled, onPress }: { children?: ReactNode; isDisabled?: boolean; onPress?: () => void }) => (
    <button type="button" disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  )
}));
vi.mock('@zivoe/ui/core/skeleton', () => ({ Skeleton: () => <span>Loading</span> }));
// Reduced to a toggle: the group's header is a button, the panel renders while expanded.
vi.mock('@zivoe/ui/core/disclosure', async () => {
  const React = await import('react');
  const Expanded = React.createContext<{ isExpanded: boolean; toggle: () => void }>({
    isExpanded: true,
    toggle: () => undefined
  });
  return {
    Disclosure: ({ children, defaultExpanded }: { children: ReactNode; defaultExpanded?: boolean }) => {
      const [isExpanded, setExpanded] = React.useState(defaultExpanded ?? false);
      return (
        <Expanded.Provider value={{ isExpanded, toggle: () => setExpanded((value) => !value) }}>
          <section>{children}</section>
        </Expanded.Provider>
      );
    },
    DisclosureHeader: ({ children }: { children: ReactNode }) => {
      const { toggle } = React.useContext(Expanded);
      return (
        <button type="button" onClick={toggle}>
          {children}
        </button>
      );
    },
    DisclosurePanel: ({ children }: { children: ReactNode }) => {
      const { isExpanded } = React.useContext(Expanded);
      return isExpanded ? <div>{children}</div> : null;
    }
  };
});

function renderRequests(identities: [TransactionIdentity, ...Array<TransactionIdentity>]) {
  return render(
    <JotaiProvider>
      <ZivoeVaultIdentityProvider identities={identities} status="Open">
        <EarnDialogProvider>
          <RequestsFlow />
        </EarnDialogProvider>
      </ZivoeVaultIdentityProvider>
    </JotaiProvider>
  );
}

const setPosition = (identity: TransactionIdentity, position: Partial<RedemptionPosition>) => {
  mocks.positions[identity.centrifugeVault.address.toLowerCase()] = position;
};

function getButton(name: string | RegExp): HTMLButtonElement {
  const button = screen.getByRole('button', { name });
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${String(name)} is not a button`);
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.address = '0x1234567890abcdef1234567890abcdef12345678';
  mocks.walletChainId = 11155111;
  mocks.positions = {};
  mocks.failing = new Set();
  mocks.pending = new Set();
  mocks.isPending = false;
  mocks.isAccountPending = false;
});

afterEach(cleanup);

describe('countRedemptionRequests', () => {
  it('counts one row per bucket, the request and its cancellation being one', () => {
    expect(countRedemptionRequests(undefined)).toBe(0);
    expect(countRedemptionRequests(EMPTY)).toBe(0);
    expect(
      countRedemptionRequests({
        ...EMPTY,
        pendingRedeemShares: 1n,
        claimableRedeemAssets: 1n,
        unfundedClaimableAssets: 1n,
        claimableCancelRedeemShares: 1n
      })
    ).toBe(4);
    expect(countRedemptionRequests({ ...EMPTY, hasPendingCancelRedeemRequest: true })).toBe(1);
    expect(countRedemptionRequests({ ...EMPTY, pendingRedeemShares: 1n, hasPendingCancelRedeemRequest: true })).toBe(1);
  });
});

describe('RequestsFlow', () => {
  it('lists every chain the wallet has a position on, whichever chain is selected, and skips the rest', () => {
    setPosition(SEPOLIA_USDC, { claimableRedeemAssets: 1_200_000000n });
    setPosition(BASE_USDC, { pendingRedeemShares: 500n * D18 });
    renderRequests([SEPOLIA_USDC, BASE_USDC]);

    // Group headers name the chain and how many rows sit under it.
    expect(getButton(/^Ethereum\s*1$/)).toBeTruthy();
    expect(getButton(/^Base\s*1$/)).toBeTruthy();
    expect(screen.getByText(/1,200\.00 USDC\s+ready to claim/)).toBeTruthy();
    expect(screen.getByText(/500\.00 zSMB\s+processing/)).toBeTruthy();
  });

  it("acts on the wallet's own chain and offers the switch on every other chain's rows", async () => {
    setPosition(SEPOLIA_USDC, { claimableRedeemAssets: 1_200_000000n });
    setPosition(BASE_USDC, { claimableRedeemAssets: 40_000000n });
    renderRequests([SEPOLIA_USDC, BASE_USDC]);

    // Sepolia is the wallet's chain: its claim is live, against its own vault.
    fireEvent.click(getButton('Claim USDC'));
    expect(mocks.claimRedeem).toHaveBeenCalledWith({
      claimableAssets: 1_200_000000n,
      centrifugeVault: SEPOLIA_USDC.centrifugeVault.address
    });

    // Base is not: its row offers the switch, which prompts the wallet.
    await act(async () => {
      fireEvent.click(getButton('Switch to Base'));
    });
    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 84532 });
  });

  it("claims against the other chain's vault once the wallet sits there", () => {
    mocks.walletChainId = 84532;
    setPosition(SEPOLIA_USDC, { claimableRedeemAssets: 1_200_000000n });
    setPosition(BASE_USDC, { claimableRedeemAssets: 40_000000n });
    renderRequests([SEPOLIA_USDC, BASE_USDC]);

    fireEvent.click(getButton('Claim USDC'));
    expect(mocks.claimRedeem).toHaveBeenCalledWith({
      claimableAssets: 40_000000n,
      centrifugeVault: BASE_USDC.centrifugeVault.address
    });
    expect(getButton('Switch to Ethereum')).toBeTruthy();
  });

  it('labels rows by coin only on a chain with several vaults', () => {
    setPosition(SEPOLIA_USDC, { claimableRedeemAssets: 2_000000n });
    setPosition(SEPOLIA_USDT, { pendingRedeemShares: 1n * D18 });
    setPosition(BASE_USDC, { pendingRedeemShares: 1n * D18 });
    renderRequests([SEPOLIA_USDC, SEPOLIA_USDT, BASE_USDC]);

    expect(getButton(/^Ethereum\s*2$/)).toBeTruthy();
    expect(screen.getByText('USDC redemption')).toBeTruthy();
    expect(screen.getByText('USDT redemption')).toBeTruthy();
    // Base holds one vault: no coin label needed there.
    expect(screen.getAllByText(/redemption$/)).toHaveLength(2);

    // The second coin's strip cancels in the second coin's vault, not the
    // chain's default.
    fireEvent.click(getButton('Cancel request'));
    expect(mocks.cancelRedeem).toHaveBeenCalledWith({
      pendingShares: 1n * D18,
      centrifugeVault: SEPOLIA_USDT.centrifugeVault.address
    });
  });

  it('collapses and expands a chain group', () => {
    setPosition(SEPOLIA_USDC, { claimableRedeemAssets: 2_000000n });
    renderRequests([SEPOLIA_USDC]);

    expect(screen.getByText(/ready to claim/)).toBeTruthy();
    fireEvent.click(getButton(/^Ethereum\s*1$/));
    expect(screen.queryByText(/ready to claim/)).toBeNull();
    fireEvent.click(getButton(/^Ethereum\s*1$/));
    expect(screen.getByText(/ready to claim/)).toBeTruthy();
  });

  it('shows a skeleton until the first vault answers, then says so when nothing is in flight', () => {
    mocks.isPending = true;
    const loading = renderRequests([SEPOLIA_USDC, BASE_USDC]);
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
    expect(screen.queryByText(/No redemption requests/)).toBeNull();
    loading.unmount();

    mocks.isPending = false;
    renderRequests([SEPOLIA_USDC, BASE_USDC]);
    expect(screen.getByText(/No redemption requests/)).toBeTruthy();
  });

  // One dead RPC must not hide the other chains' answers behind the skeleton
  // for a minute of retries — nor pass an empty tab off as a settled answer.
  it('renders what has landed while a chain is still on its first read, and names that chain', () => {
    setPosition(SEPOLIA_USDC, { claimableRedeemAssets: 1_000000n });
    mocks.pending = new Set([BASE_USDC.centrifugeVault.address.toLowerCase()]);
    const withPosition = renderRequests([SEPOLIA_USDC, BASE_USDC]);
    expect(screen.getByText(/ready to claim/)).toBeTruthy();
    expect(screen.getByText('Still checking Base…')).toBeTruthy();
    expect(screen.queryByText('Loading')).toBeNull();
    withPosition.unmount();

    mocks.positions = {};
    renderRequests([SEPOLIA_USDC, BASE_USDC]);
    expect(screen.getByText(/No redemption requests/)).toBeTruthy();
    expect(screen.getByText('Still checking Base…')).toBeTruthy();
  });

  it('shows the skeleton, not the connect prompt, while the wallet SDK is still loading', () => {
    mocks.isAccountPending = true;
    renderRequests([SEPOLIA_USDC]);
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Connect your wallet/)).toBeNull();
    expect(screen.queryByText(/No redemption requests/)).toBeNull();
  });

  it('asks for a wallet when none is connected', () => {
    cleanup();
    mocks.address = undefined;
    renderRequests([SEPOLIA_USDC]);
    expect(screen.getByText(/Connect your wallet to see your redemption requests/)).toBeTruthy();
    expect(screen.getByText('Connect Wallet')).toBeTruthy();
  });

  it('keeps a chain listed, with a notice, when one of its position reads fails', () => {
    setPosition(SEPOLIA_USDC, { claimableRedeemAssets: 2_000000n });
    mocks.failing = new Set([BASE_USDC.centrifugeVault.address.toLowerCase()]);
    renderRequests([SEPOLIA_USDC, BASE_USDC]);

    const base = getButton(/^Base\s*0$/).closest('section');
    expect(base).toBeTruthy();
    expect(within(base!).getByText(/Could not load every position on Base/)).toBeTruthy();
    expect(screen.getByText(/ready to claim/)).toBeTruthy();
  });
});
