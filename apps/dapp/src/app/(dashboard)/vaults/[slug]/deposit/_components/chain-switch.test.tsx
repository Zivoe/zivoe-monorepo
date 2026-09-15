// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider, createStore } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { type TransactionIdentity } from '@/centrifuge';
import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { ZivoeVaultIdentityProvider } from '../../zivoe-vault-provider';
import { type DepositTab, SwitchChainButton, useSelectedChain, useSelectedIdentity } from './chain-switch';

/** The two chains this suite drives (identityOnChain derives their real chainIds: 11155111 / 84532). */
type TestChain = Extract<CentrifugeChain, 'sepolia' | 'base-sepolia'>;

/** The fixture identity re-pinned to one chain — the hook reads only centrifugeVault.chain. */
function identityOn(chain: TestChain): TransactionIdentity {
  return identityOnChain(FIXTURE_IDENTITY, chain);
}

type SwitchMocks = {
  switchChain: ReturnType<typeof vi.fn>;
  /** Set to make the next switch fail through the hook's mutation onError. */
  switchError: Error | undefined;
  toast: ReturnType<typeof vi.fn>;
  /** The reconnecting-wallet test clears it to model an unknown chain. */
  walletChainId: number | undefined;
  /** One entry per unsettled prompt — a test settles them explicitly, in any order. */
  settlePending: Array<() => void>;
};

const mocks = vi.hoisted(
  (): SwitchMocks => ({
    switchChain: vi.fn(),
    switchError: undefined,
    toast: vi.fn(),
    walletChainId: 11155111,
    settlePending: []
  })
);

// Mirrors the real mutation lifecycle order (onMutate → onError → onSettled)
// so the module's shared pending count is actually exercised: a rejected
// switch settles immediately; a granted prompt stays open until the test
// settles it.
vi.mock('wagmi', () => ({
  useConnection: () => ({ chainId: mocks.walletChainId }),
  useSwitchChain: (options?: {
    mutation?: {
      onMutate?: (vars: { chainId: number }) => void;
      onError?: (error: Error, vars: { chainId: number }) => void;
      onSettled?: () => void;
    };
  }) => ({
    mutate: (vars: { chainId: number }) => {
      mocks.switchChain(vars);
      options?.mutation?.onMutate?.(vars);
      if (mocks.switchError) {
        options?.mutation?.onError?.(mocks.switchError, vars);
        options?.mutation?.onSettled?.();
      } else {
        mocks.settlePending.push(() => options?.mutation?.onSettled?.());
      }
    },
    isPending: false
  })
}));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: mocks.toast, Toaster: () => null }));
// Imported by the module under test; the workspace package does not transform
// under vitest (same mocks as the flow suites).
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({
    children,
    isPending,
    pendingContent,
    onPress
  }: {
    children?: ReactNode;
    isPending?: boolean;
    pendingContent?: ReactNode;
    onPress?: () => void;
  }) => (
    <button type="button" onClick={onPress}>
      {isPending && pendingContent ? pendingContent : children}
    </button>
  )
}));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));

/** A minimal consumer — the flows' contract with the hook, without the flows. */
function Consumer({ label, select }: { label: string; select: CentrifugeChain }) {
  const { selectedChain, setSelectedChain, needsChainSwitch } = useSelectedChain();

  return (
    <div>
      <span>
        {label}: {selectedChain}
      </span>
      <span>{needsChainSwitch ? `${label}-switch-needed` : `${label}-no-switch`}</span>
      <button type="button" onClick={() => setSelectedChain(select)}>
        {label}-select
      </button>
    </div>
  );
}

/** A consumer of the narrowed selection — reports which vault the tab transacts against. */
function IdentityConsumer({ label, tab, select }: { label: string; tab: DepositTab; select: TransactionIdentity }) {
  const { selectedIdentity, setSelectedIdentity } = useSelectedIdentity({ tab });

  return (
    <div>
      <span>
        {label}: {selectedIdentity.centrifugeVault.chain} {selectedIdentity.centrifugeVault.asset.symbol}
      </span>
      <button type="button" onClick={() => setSelectedIdentity(select)}>
        {label}-select
      </button>
    </div>
  );
}

function renderConsumers({
  store,
  chains,
  identities,
  children
}: {
  store: ReturnType<typeof createStore>;
  chains?: Array<TestChain>;
  /** Explicit identities win over `chains` — for suites with several vaults on one chain. */
  identities?: Array<TransactionIdentity>;
  children: ReactNode;
}) {
  const [first, ...rest] = identities ?? (chains ?? []).map(identityOn);
  if (!first) throw new Error('renderConsumers needs at least one chain');

  return render(
    <JotaiProvider store={store}>
      <ZivoeVaultIdentityProvider identities={[first, ...rest]} status="Open">
        {children}
      </ZivoeVaultIdentityProvider>
    </JotaiProvider>
  );
}

afterEach(() => {
  cleanup();
  mocks.switchChain.mockClear();
  mocks.toast.mockClear();
  mocks.switchError = undefined;
  mocks.walletChainId = 11155111;
  mocks.settlePending.length = 0;
});

describe('useSelectedChain', () => {
  it('shares one selection across every consumer — the tabs cannot disagree', () => {
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: (
        <>
          <Consumer label="deposit" select="base-sepolia" />
          <Consumer label="redeem" select="sepolia" />
        </>
      )
    });

    expect(screen.getByText('deposit: sepolia')).toBeTruthy();
    expect(screen.getByText('redeem: sepolia')).toBeTruthy();

    fireEvent.click(screen.getByText('deposit-select'));

    expect(screen.getByText('deposit: base-sepolia')).toBeTruthy();
    expect(screen.getByText('redeem: base-sepolia')).toBeTruthy();
  });

  it('prompts the wallet to switch immediately on selecting a chain it is not connected to', () => {
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="deposit" select="base-sepolia" />
    });

    fireEvent.click(screen.getByText('deposit-select'));
    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 84532 });
  });

  it("does not prompt when selecting the wallet's own chain", () => {
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="deposit" select="sepolia" />
    });

    fireEvent.click(screen.getByText('deposit-select'));
    expect(mocks.switchChain).not.toHaveBeenCalled();
  });

  it('surfaces a refused network switch as an error toast instead of a silent no-op', () => {
    mocks.switchError = new Error('User rejected the request.');
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="deposit" select="base-sepolia" />
    });

    fireEvent.click(screen.getByText('deposit-select'));
    expect(mocks.toast).toHaveBeenCalledWith({ type: 'error', title: 'Could not switch to Base' });
  });

  it('treats an unknown wallet chain (reconnecting) as no mismatch — no switch CTA flash, no prompt', () => {
    mocks.walletChainId = undefined;
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="deposit" select="base-sepolia" />
    });

    expect(screen.getByText('deposit-no-switch')).toBeTruthy();

    fireEvent.click(screen.getByText('deposit-select'));
    expect(mocks.switchChain).not.toHaveBeenCalled();
  });

  it('keeps the switch button pending until the LAST of overlapping prompts settles', () => {
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: (
        <>
          <Consumer label="deposit" select="base-sepolia" />
          <SwitchChainButton />
        </>
      )
    });

    // Two prompts in flight: the selector deliberately stays unlocked during
    // a switch, so re-selecting fires a second prompt before the first
    // settles.
    fireEvent.click(screen.getByText('deposit-select'));
    fireEvent.click(screen.getByText('deposit-select'));
    expect(mocks.settlePending).toHaveLength(2);
    expect(screen.getByText('Switching Network...')).toBeTruthy();

    // The FIRST prompt settling must not free the button — the second prompt
    // is still open, and an enabled button would offer a third.
    act(() => mocks.settlePending[0]?.());
    expect(screen.getByText('Switching Network...')).toBeTruthy();

    act(() => mocks.settlePending[1]?.());
    expect(screen.getByText('Switch to Base')).toBeTruthy();
  });

  it("defaults to the wallet's connected chain when nothing is stored — and needs no switch there", () => {
    mocks.walletChainId = 84532;
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="deposit" select="sepolia" />
    });

    expect(screen.getByText('deposit: base-sepolia')).toBeTruthy();
    expect(screen.getByText('deposit-no-switch')).toBeTruthy();
  });

  it("prefers a persisted selection over the wallet's chain on a fresh mount", () => {
    mocks.walletChainId = 84532;
    const firstLoad = renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="a" select="sepolia" />
    });
    fireEvent.click(screen.getByText('a-select'));
    expect(screen.getByText('a: sepolia')).toBeTruthy();
    firstLoad.unmount();

    // The wallet still sits on base-sepolia, but the user's explicit choice wins.
    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="b" select="sepolia" />
    });
    expect(screen.getByText('b: sepolia')).toBeTruthy();
    expect(screen.getByText('b-switch-needed')).toBeTruthy();
  });

  it('restores the persisted selection on a fresh mount, like a page refresh', () => {
    // Fresh Jotai stores model separate page loads: only localStorage carries over.
    const firstLoad = renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="a" select="base-sepolia" />
    });
    fireEvent.click(screen.getByText('a-select'));
    expect(screen.getByText('a: base-sepolia')).toBeTruthy();
    firstLoad.unmount();

    renderConsumers({
      store: createStore(),
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="b" select="sepolia" />
    });
    expect(screen.getByText('b: base-sepolia')).toBeTruthy();
  });

  it("falls back to the first chain when the stored selection is not live on this Zivoe Vault's page", () => {
    // One store across two pages, like a client-side navigation between Zivoe Vaults.
    const store = createStore();

    const firstPage = renderConsumers({
      store,
      chains: ['sepolia', 'base-sepolia'],
      children: <Consumer label="a" select="base-sepolia" />
    });
    fireEvent.click(screen.getByText('a-select'));
    expect(screen.getByText('a: base-sepolia')).toBeTruthy();
    firstPage.unmount();

    // The next Zivoe Vault serves sepolia only — the leftover selection must not stick.
    renderConsumers({ store, chains: ['sepolia'], children: <Consumer label="b" select="sepolia" /> });
    expect(screen.getByText('b: sepolia')).toBeTruthy();
  });
});

describe('useSelectedIdentity', () => {
  const USDC_SEPOLIA = identityOn('sepolia');
  const USDT_SEPOLIA = identityOnChain(FIXTURE_IDENTITY, 'sepolia', {
    address: '0xc3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',
    asset: { address: '0xf0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0', symbol: 'USDT', decimals: 6 }
  });
  const USDC_BASE = identityOn('base-sepolia');

  it("opens on the chain's default (first) vault and keeps each tab's coin apart", () => {
    renderConsumers({
      store: createStore(),
      identities: [USDC_SEPOLIA, USDT_SEPOLIA, USDC_BASE],
      children: (
        <>
          <IdentityConsumer label="deposit" tab="deposit" select={USDT_SEPOLIA} />
          <IdentityConsumer label="redeem" tab="redeem" select={USDT_SEPOLIA} />
        </>
      )
    });

    expect(screen.getByText('deposit: sepolia USDC')).toBeTruthy();
    expect(screen.getByText('redeem: sepolia USDC')).toBeTruthy();

    // Funding a deposit with USDT says nothing about which coin to be paid out in.
    fireEvent.click(screen.getByText('deposit-select'));
    expect(screen.getByText('deposit: sepolia USDT')).toBeTruthy();
    expect(screen.getByText('redeem: sepolia USDC')).toBeTruthy();
  });

  it('selecting a vault on another chain moves the shared chain selection and prompts the switch', () => {
    renderConsumers({
      store: createStore(),
      identities: [USDC_SEPOLIA, USDT_SEPOLIA, USDC_BASE],
      children: (
        <>
          <IdentityConsumer label="deposit" tab="deposit" select={USDC_BASE} />
          <Consumer label="redeem" select="sepolia" />
        </>
      )
    });

    fireEvent.click(screen.getByText('deposit-select'));

    expect(screen.getByText('deposit: base-sepolia USDC')).toBeTruthy();
    expect(screen.getByText('redeem: base-sepolia')).toBeTruthy();
    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 84532 });
  });

  it('remembers the coin per chain, and falls back to the default when the stored vault is gone', () => {
    const store = createStore();
    const firstPage = renderConsumers({
      store,
      identities: [USDC_SEPOLIA, USDT_SEPOLIA, USDC_BASE],
      children: <IdentityConsumer label="a" tab="deposit" select={USDT_SEPOLIA} />
    });
    fireEvent.click(screen.getByText('a-select'));
    expect(screen.getByText('a: sepolia USDT')).toBeTruthy();
    firstPage.unmount();

    // Persisted: a fresh mount on the same page reopens on USDT.
    const secondPage = renderConsumers({
      store: createStore(),
      identities: [USDC_SEPOLIA, USDT_SEPOLIA, USDC_BASE],
      children: <IdentityConsumer label="b" tab="deposit" select={USDT_SEPOLIA} />
    });
    expect(screen.getByText('b: sepolia USDT')).toBeTruthy();
    secondPage.unmount();

    // A deploy that dropped the USDT vault: the stale choice yields to the default.
    renderConsumers({
      store: createStore(),
      identities: [USDC_SEPOLIA, USDC_BASE],
      children: <IdentityConsumer label="c" tab="deposit" select={USDC_SEPOLIA} />
    });
    expect(screen.getByText('c: sepolia USDC')).toBeTruthy();
  });
});
