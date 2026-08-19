// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider, createStore } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { type TransactionIdentity } from '@/centrifuge';
import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { ZivoeVaultIdentityProvider } from '../../zivoe-vault-provider';
import { useSelectedChain } from './chain-switch';

const CHAIN_IDS = { sepolia: 11155111, 'base-sepolia': 84532 } as const;

/** The fixture identity re-pinned to one chain — the hook reads only centrifugeVault.chain. */
function identityOn(chain: keyof typeof CHAIN_IDS): TransactionIdentity {
  return {
    ...FIXTURE_IDENTITY,
    centrifugeVault: { ...FIXTURE_IDENTITY.centrifugeVault, chain, chainId: CHAIN_IDS[chain] }
  };
}

type SwitchMocks = {
  switchChain: ReturnType<typeof vi.fn>;
  /** Set to make the next switch fail through the hook's mutation onError. */
  switchError: Error | undefined;
  toast: ReturnType<typeof vi.fn>;
  /** The reconnecting-wallet test clears it to model an unknown chain. */
  walletChainId: number | undefined;
};

const mocks = vi.hoisted(
  (): SwitchMocks => ({
    switchChain: vi.fn(),
    switchError: undefined,
    toast: vi.fn(),
    walletChainId: 11155111
  })
);

vi.mock('wagmi', () => ({
  useConnection: () => ({ chainId: mocks.walletChainId }),
  useSwitchChain: (options?: { mutation?: { onError?: (error: Error, vars: { chainId: number }) => void } }) => ({
    mutate: (vars: { chainId: number }) => {
      mocks.switchChain(vars);
      if (mocks.switchError) options?.mutation?.onError?.(mocks.switchError, vars);
    },
    isPending: false
  })
}));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: mocks.toast, Toaster: () => null }));
// Imported by the module under test; the workspace package does not transform
// under vitest (same mocks as the flow suites).
vi.mock('@zivoe/ui/core/button', () => ({ Button: () => null }));
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

function renderConsumers({
  store,
  chains,
  children
}: {
  store: ReturnType<typeof createStore>;
  chains: Array<keyof typeof CHAIN_IDS>;
  children: ReactNode;
}) {
  const [first, ...rest] = chains.map(identityOn);
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
