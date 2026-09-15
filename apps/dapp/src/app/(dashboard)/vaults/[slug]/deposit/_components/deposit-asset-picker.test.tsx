// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { DepositAssetPicker } from './deposit-asset-picker';

// Real @zivoe/ui primitives on purpose: the two-pane dialog is what this proves.
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));

// The wallet's balance of each coin on each chain — the picker reads these,
// prints them on the rows and orders the rows by them.
const balances = vi.hoisted(() => new Map<string, bigint>());
const balanceKey = (chain: string, tokenAddress: string) => `${chain}:${tokenAddress.toLowerCase()}`;
vi.mock('@/hooks/useBalance', () => ({
  useBalance: ({ chain, tokenAddress }: { chain: string; tokenAddress: string }) => ({
    data: balances.get(`${chain}:${tokenAddress.toLowerCase()}`),
    isFetching: false,
    isPending: false
  }),
  useTokenBalances: () => (token: { chain: string; tokenAddress: string }) =>
    balances.get(`${token.chain}:${token.tokenAddress.toLowerCase()}`)
}));

/** Two coins on sepolia, one on base-sepolia — the grouped-and-flat mix the picker must handle. */
const USDC_SEPOLIA = identityOnChain(FIXTURE_IDENTITY, 'sepolia');
// An 18-decimal coin beside 6-decimal ones: raw balances are not comparable.
const USDT_SEPOLIA = identityOnChain(FIXTURE_IDENTITY, 'sepolia', {
  address: '0xc3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',
  asset: { address: '0xf0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0', symbol: 'USDT', decimals: 18 }
});
const USDC_BASE = identityOnChain(FIXTURE_IDENTITY, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3'
});
const IDENTITIES = [USDC_SEPOLIA, USDT_SEPOLIA, USDC_BASE];

function setBalance(identity: typeof FIXTURE_IDENTITY, value: bigint) {
  const { chain, asset } = identity.centrifugeVault;
  balances.set(balanceKey(chain, asset.address), value);
}

function renderPicker(onSelect = vi.fn()) {
  // A fresh element per render: React skips a child handed the very same element again.
  const picker = () => (
    <DepositAssetPicker identities={IDENTITIES} selected={USDC_SEPOLIA} onSelect={onSelect} isDisabled={false} />
  );
  const { rerender } = render(picker());
  return { onSelect, rerender: () => rerender(picker()) };
}

async function openDialog() {
  await act(async () => {
    // The trigger's name carries the current selection.
    fireEvent.click(screen.getByRole('button', { name: 'Select token to deposit, currently USDC on Ethereum' }));
  });
  return screen.getByRole('dialog');
}

/** The coin rows in the order the dialog lists them. */
function listedRows(dialog: HTMLElement) {
  return within(dialog)
    .getAllByText(/^(USDC|USDT)( on \w+)?$/)
    .map((row) => row.textContent);
}

beforeEach(() => {
  balances.clear();
  setBalance(USDC_SEPOLIA, 10_000000n);
  setBalance(USDT_SEPOLIA, 7_000000000000000000n);
  setBalance(USDC_BASE, 3_000000n);
});

afterEach(cleanup);

describe('DepositAssetPicker', () => {
  it('lists every network with its coin count and every coin with its balance under "All networks"', async () => {
    renderPicker();
    const dialog = await openDialog();

    expect(within(dialog).getByRole('heading', { name: 'Select token to deposit' })).toBeTruthy();
    // One choice among several: a radio group, with the current filter checked.
    const networks = within(dialog).getByRole('radiogroup', { name: 'Networks' });
    expect(within(networks).getByRole('radio', { name: 'All networks 3', checked: true })).toBeTruthy();
    expect(within(networks).getByRole('radio', { name: 'Ethereum 2', checked: false })).toBeTruthy();
    expect(within(networks).getByRole('radio', { name: 'Base 1', checked: false })).toBeTruthy();

    // Across all networks each row names its chain, with the wallet's balance of that coin there.
    expect(listedRows(dialog)).toEqual(['USDC on Ethereum', 'USDT on Ethereum', 'USDC on Base']);
    // The balance row prints its number in its own element.
    expect(within(dialog).getByText('3.00').closest('p')?.textContent).toBe('Balance: 3.00');
  });

  it('orders the rows by balance across chains, compared at one scale across decimals', async () => {
    // Base's 3 USDC sits between Ethereum's two coins: the chain holding the
    // most does not carry its empty coins up with it. The 18-decimal USDT's
    // raw balance dwarfs both USDC ones, yet 1 < 3 once all are at one scale.
    setBalance(USDT_SEPOLIA, 1_000000000000000000n);
    renderPicker();
    const dialog = await openDialog();

    expect(listedRows(dialog)).toEqual(['USDC on Ethereum', 'USDC on Base', 'USDT on Ethereum']);
  });

  it('keeps the order it opened with while balances change, and sorts afresh on the next open', async () => {
    const { rerender } = renderPicker();
    let dialog = await openDialog();
    expect(listedRows(dialog)).toEqual(['USDC on Ethereum', 'USDT on Ethereum', 'USDC on Base']);

    // A balance lands while the dialog is open: the rows stay put, the balance shown is the new one.
    setBalance(USDC_BASE, 30_000000n);
    await act(async () => rerender());
    expect(listedRows(dialog)).toEqual(['USDC on Ethereum', 'USDT on Ethereum', 'USDC on Base']);
    expect(within(dialog).getByText('30.00')).toBeTruthy();

    // Choosing a row closes the dialog; the next open orders by the balances of that moment.
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /^USDC on Ethereum/ }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    dialog = await openDialog();
    expect(listedRows(dialog)).toEqual(['USDC on Base', 'USDC on Ethereum', 'USDT on Ethereum']);
  });

  it('filters to one network, whose rows then name the coin alone, and hands back the chosen vault', async () => {
    const { onSelect } = renderPicker();
    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Base 1' }));
    });

    expect(within(dialog).getByRole('radio', { name: 'Base 1', checked: true })).toBeTruthy();
    expect(within(dialog).queryByText(/on Ethereum/)).toBeNull();
    expect(within(dialog).queryByText('USDT')).toBeNull();
    const row = within(dialog).getByRole('button', { name: 'USDC US Dollar Coin Balance: 3.00' });

    await act(async () => {
      fireEvent.click(row);
    });
    expect(onSelect).toHaveBeenCalledWith(USDC_BASE);
  });

  it('keeps two chains apart when their vaults share one address, and hands back the one clicked', async () => {
    // Deterministic deployment puts USD1's vault at one address on Ethereum
    // and BNB Smart Chain; keyed by address alone, the rows would collide.
    const SHARED = '0xd1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1';
    const usd1Sepolia = identityOnChain(FIXTURE_IDENTITY, 'sepolia', {
      address: SHARED,
      asset: { address: '0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1', symbol: 'USD1', decimals: 18 }
    });
    const usd1Base = identityOnChain(FIXTURE_IDENTITY, 'base-sepolia', {
      address: SHARED,
      asset: { address: '0xe2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2', symbol: 'USD1', decimals: 6 }
    });
    const onSelect = vi.fn();
    render(
      <DepositAssetPicker
        identities={[usd1Sepolia, usd1Base]}
        selected={usd1Sepolia}
        onSelect={onSelect}
        isDisabled={false}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select token to deposit, currently USD1 on Ethereum' }));
    });
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('USD1 on Ethereum')).toBeTruthy();
    expect(within(dialog).getByText('USD1 on Base')).toBeTruthy();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /USD1 on Base/ }));
    });
    expect(onSelect).toHaveBeenCalledWith(usd1Base);
  });

  it('searches the coin, never the network', async () => {
    renderPicker();
    const dialog = await openDialog();
    const search = within(dialog).getByRole('searchbox', { name: 'Search a token' });

    fireEvent.change(search, { target: { value: 'usdt' } });
    expect(within(dialog).getByText('USDT on Ethereum')).toBeTruthy();
    expect(within(dialog).queryByText('USDC on Ethereum')).toBeNull();

    // A network name is not a token: the box does not double as the network list.
    fireEvent.change(search, { target: { value: 'base' } });
    expect(within(dialog).queryByText('USDC on Base')).toBeNull();
    expect(within(dialog).getByText(/No token matches “base”/)).toBeTruthy();

    // The X empties the box in one press and brings every coin back.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveProperty('value', '');
    expect(listedRows(dialog)).toHaveLength(IDENTITIES.length);
  });
});
