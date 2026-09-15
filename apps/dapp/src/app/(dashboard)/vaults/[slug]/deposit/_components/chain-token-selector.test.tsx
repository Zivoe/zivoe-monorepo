// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ChainSelectorRow, ChainTokenSelector, sortRowsByBalance } from './chain-token-selector';

// Real @zivoe/ui primitives on purpose — the flow suites stub this control.
// Only the icon barrel is mocked (raw UI TSX icons do not transform here).
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

// jsdom ships no CSS.escape; react-aria's collections call it when keying items.
if (typeof globalThis.CSS === 'undefined') globalThis.CSS = { escape: (value: string) => value } as typeof CSS;

const zsmb = { label: 'zSMB', description: 'Zivoe SMB Credit', icon: null };
const usdc = { label: 'USDC', description: 'US Dollar Coin', icon: null };
const usdt = { label: 'USDT', description: 'Tether USD', icon: null };

/** The redeem tab's chain selector: one row per chain, the share token on each. */
const CHAIN_ROWS: Array<ChainSelectorRow> = [
  { id: 'sepolia', chain: 'sepolia', token: zsmb, detail: <span>Balance: 10.00</span> },
  { id: 'base-sepolia', chain: 'base-sepolia', token: zsmb, detail: <span>Balance: 25.00</span> }
];

/** The redeem tab's payout selector: one row per coin of ONE chain. */
const PAYOUT_ROWS: Array<ChainSelectorRow> = [
  { id: 'usdc', chain: 'sepolia', token: usdc, detail: <span>Balance: 350.00</span> },
  { id: 'usdt', chain: 'sepolia', token: usdt, detail: <span>Balance: 9,980.00</span> }
];

afterEach(cleanup);

describe('ChainTokenSelector', () => {
  it('opens a dialog of "token on chain" rows with their balances and selects through it', async () => {
    const onSelect = vi.fn();
    render(
      <ChainTokenSelector
        title="Select Asset"
        rows={CHAIN_ROWS}
        selectedId="sepolia"
        onSelect={onSelect}
        isDisabled={false}
      />
    );

    // Both triggers render in jsdom (no CSS breakpoints); the dialog's is first.
    const [dialogTrigger] = screen.getAllByRole('button', { name: 'zSMB Ethereum' });
    await act(async () => {
      fireEvent.click(dialogTrigger!);
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Select Asset')).toBeTruthy();
    expect(within(dialog).getByText('zSMB on Ethereum')).toBeTruthy();
    expect(within(dialog).getByText('zSMB on Base')).toBeTruthy();
    expect(within(dialog).getByText('Balance: 25.00')).toBeTruthy();
    // The current choice is named as such; the hover fill alone cannot tell it apart.
    expect(
      within(dialog)
        .getByRole('button', { name: /zSMB on Ethereum/ })
        .getAttribute('aria-current')
    ).toBe('true');
    expect(
      within(dialog)
        .getByRole('button', { name: /zSMB on Base/ })
        .getAttribute('aria-current')
    ).toBeNull();

    await act(async () => {
      fireEvent.click(within(dialog).getByText('zSMB on Base'));
    });
    expect(onSelect).toHaveBeenCalledWith('base-sepolia');
  });

  it('names coins alone on the payout variant — the chain is settled — and shows no checkmark', async () => {
    const onSelect = vi.fn();
    render(
      <ChainTokenSelector
        title="Select token to receive"
        trigger="token"
        rows={PAYOUT_ROWS}
        selectedId="usdc"
        onSelect={onSelect}
        isDisabled={false}
      />
    );

    const [dialogTrigger] = screen.getAllByRole('button', { name: 'USDC' });
    await act(async () => {
      fireEvent.click(dialogTrigger!);
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('USDT')).toBeTruthy();
    expect(within(dialog).queryByText(/on Ethereum/)).toBeNull();
    expect(within(dialog).getByText('Balance: 9,980.00')).toBeTruthy();
    expect(within(dialog).queryByRole('img', { name: /check/i })).toBeNull();

    await act(async () => {
      fireEvent.click(within(dialog).getByText('USDT'));
    });
    expect(onSelect).toHaveBeenCalledWith('usdt');
  });

  it('offers the same rows on the mobile select', async () => {
    const onSelect = vi.fn();
    render(
      <ChainTokenSelector
        title="Select Asset"
        rows={CHAIN_ROWS}
        selectedId="sepolia"
        onSelect={onSelect}
        isDisabled={false}
      />
    );

    // Named with its current selection: the trigger renders no SelectValue.
    const select = screen.getByRole('button', { name: 'Select Asset: zSMB on Ethereum' });
    await act(async () => {
      fireEvent.keyDown(select, { key: 'ArrowDown' });
    });

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['zSMB on Ethereum', 'zSMB on Base']);

    await act(async () => {
      fireEvent.click(options[1]!);
    });
    expect(onSelect).toHaveBeenCalledWith('base-sepolia');
  });
});

describe('sortRowsByBalance', () => {
  const rows: Array<ChainSelectorRow> = [
    { id: 'sepolia-usdc', chain: 'sepolia', token: usdc },
    { id: 'sepolia-usdt', chain: 'sepolia', token: usdt },
    { id: 'base-usdc', chain: 'base-sepolia', token: usdc }
  ];
  const ids = (sorted: Array<ChainSelectorRow>) => sorted.map((row) => row.id);

  it('orders the rows by balance alone, largest first, across chains', () => {
    // Base's coin outranks sepolia's smaller one even though sepolia holds the most.
    const balances: Record<string, bigint | undefined> = { 'sepolia-usdc': 10n, 'sepolia-usdt': 40n, 'base-usdc': 25n };
    expect(ids(sortRowsByBalance(rows, (row) => balances[row.id]))).toEqual([
      'sepolia-usdt',
      'base-usdc',
      'sepolia-usdc'
    ]);

    balances['sepolia-usdt'] = 5n;
    expect(ids(sortRowsByBalance(rows, (row) => balances[row.id]))).toEqual([
      'base-usdc',
      'sepolia-usdc',
      'sepolia-usdt'
    ]);
  });

  it('keeps the catalog order for ties, zeros and unknown balances', () => {
    expect(ids(sortRowsByBalance(rows, () => undefined))).toEqual(ids(rows));
    expect(ids(sortRowsByBalance(rows, () => 0n))).toEqual(ids(rows));
    // An unknown balance never outranks a known zero, nor the other way round.
    expect(ids(sortRowsByBalance(rows, (row) => (row.id === 'base-usdc' ? 0n : undefined)))).toEqual(ids(rows));
  });
});
