// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { type ChainIdentities } from './chain-switch';
import { ShareChainSelector } from './share-chain-selector';

// Real @zivoe/ui primitives on purpose — the flow suite stubs the selector.
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ isPending: false, isDisconnected: false, address: '0x1234567890abcdef1234567890abcdef12345678' })
}));

// jsdom ships no CSS.escape; react-aria's collections call it when keying items.
if (typeof globalThis.CSS === 'undefined') globalThis.CSS = { escape: (value: string) => value } as typeof CSS;

// The wallet's share balance per chain (the fixture class has 8 decimals).
const balances = vi.hoisted(() => new Map<string, bigint>());
vi.mock('@/hooks/useBalance', () => ({
  useBalance: ({ chain }: { chain: string }) => ({ data: balances.get(chain), isFetching: false, isPending: false }),
  useTokenBalances: () => (token: { chain: string }) => balances.get(token.chain)
}));

const SEPOLIA = identityOnChain(FIXTURE_IDENTITY, 'sepolia');
const BASE = identityOnChain(FIXTURE_IDENTITY, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3'
});
const CHAINS: Array<ChainIdentities> = [
  { chain: 'sepolia', identities: [SEPOLIA] },
  { chain: 'base-sepolia', identities: [BASE] }
];

afterEach(cleanup);

describe('ShareChainSelector', () => {
  it("lists one row per chain with that chain's share balance, the larger holding first, and hands back the chain", async () => {
    balances.set('sepolia', 10_00000000n);
    balances.set('base-sepolia', 25_00000000n);
    const onSelect = vi.fn();
    render(<ShareChainSelector chains={CHAINS} selectedChain="sepolia" onSelect={onSelect} isDisabled={false} />);

    // Both triggers render in jsdom (no CSS breakpoints); each names what it does and the current choice.
    const dialogTrigger = screen.getByRole('button', { name: 'Select network, currently zFIX on Ethereum' });
    await act(async () => {
      fireEvent.click(dialogTrigger);
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Select network')).toBeTruthy();
    expect(
      within(dialog)
        .getAllByText(/^zFIX on /)
        .map((row) => row.textContent)
    ).toEqual(['zFIX on Base', 'zFIX on Ethereum']);
    // The balance row prints its number in its own element.
    expect(within(dialog).getByText('25.00').closest('p')?.textContent).toBe('Balance: 25.00');

    await act(async () => {
      fireEvent.click(within(dialog).getByText('zFIX on Base'));
    });
    expect(onSelect).toHaveBeenCalledWith('base-sepolia');
  });
});
