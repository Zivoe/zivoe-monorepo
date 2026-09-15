// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ChainSelectorRow } from './chain-token-selector';
import { DepositAssetPicker } from './deposit-asset-picker';

// Real @zivoe/ui primitives on purpose: the two-pane dialog is what this proves.
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

const usdc = { label: 'USDC', description: 'US Dollar Coin', icon: null };
const usdt = { label: 'USDT', description: 'Tether USD', icon: null };

/** Two coins on sepolia, one on base-sepolia — the grouped-and-flat mix the picker must handle. */
const ROWS: Array<ChainSelectorRow> = [
  { id: 'sepolia-usdc', chain: 'sepolia', token: usdc, detail: <span>Balance: 10.00</span> },
  { id: 'sepolia-usdt', chain: 'sepolia', token: usdt, detail: <span>Balance: 7.00</span> },
  { id: 'base-usdc', chain: 'base-sepolia', token: usdc, detail: <span>Balance: 3.00</span> }
];

function renderPicker(onSelect = vi.fn()) {
  render(<DepositAssetPicker rows={ROWS} selectedId="sepolia-usdc" onSelect={onSelect} isDisabled={false} />);
  return onSelect;
}

async function openDialog() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Select token to deposit' }));
  });
  return screen.getByRole('dialog');
}

afterEach(cleanup);

describe('DepositAssetPicker', () => {
  it('lists every network with its coin count and every coin with its balance under "All networks"', async () => {
    renderPicker();
    const dialog = await openDialog();

    expect(within(dialog).getByText('Select token to deposit')).toBeTruthy();
    const networks = within(dialog).getByRole('navigation', { name: 'Networks' });
    expect(within(networks).getByRole('button', { name: 'All networks 3' })).toBeTruthy();
    expect(within(networks).getByRole('button', { name: 'Ethereum 2' })).toBeTruthy();
    expect(within(networks).getByRole('button', { name: 'Base 1' })).toBeTruthy();

    // Across all networks each row names its chain, with the wallet's balance of that coin there.
    expect(within(dialog).getByText('USDC on Ethereum')).toBeTruthy();
    expect(within(dialog).getByText('USDT on Ethereum')).toBeTruthy();
    expect(within(dialog).getByText('USDC on Base')).toBeTruthy();
    expect(within(dialog).getByText('Balance: 3.00')).toBeTruthy();
  });

  it('filters to one network, whose rows then name the coin alone', async () => {
    const onSelect = renderPicker();
    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Base 1' }));
    });

    expect(within(dialog).queryByText(/on Ethereum/)).toBeNull();
    expect(within(dialog).queryByText('USDT')).toBeNull();
    const row = within(dialog).getByRole('button', { name: 'USDC US Dollar Coin Balance: 3.00' });

    await act(async () => {
      fireEvent.click(row);
    });
    expect(onSelect).toHaveBeenCalledWith('base-usdc');
  });

  it('searches the coin, never the network', async () => {
    renderPicker();
    const dialog = await openDialog();
    const search = within(dialog).getByRole('searchbox', { name: 'Search a token' });

    fireEvent.change(search, { target: { value: 'tether' } });
    expect(within(dialog).getByText('USDT on Ethereum')).toBeTruthy();
    expect(within(dialog).queryByText('USDC on Ethereum')).toBeNull();

    // A network name is not a token: the box does not double as the network list.
    fireEvent.change(search, { target: { value: 'base' } });
    expect(within(dialog).queryByText('USDC on Base')).toBeNull();
    expect(within(dialog).getByText(/No token matches “base”/)).toBeTruthy();
  });
});
