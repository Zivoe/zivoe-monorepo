// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ZSMB_ZIVOE_VAULT } from '@/zivoe-vaults/zsmb';

import { AcceptedChainIcons, AcceptedStablecoinIcons } from './zivoe-vault-icons';

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

describe('stacked logo rows', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    { row: 'AcceptedChainIcons', Row: AcceptedChainIcons, name: 'Ethereum' },
    { row: 'AcceptedStablecoinIcons', Row: AcceptedStablecoinIcons, name: 'USDC' }
  ])('$row names the logo in a tooltip while it is hovered', async ({ Row, name }) => {
    vi.useFakeTimers();
    render(<Row zivoeVault={ZSMB_ZIVOE_VAULT} />);

    const logo = screen.getByRole('img', { name });
    expect(screen.queryByRole('tooltip')).toBeNull();

    // react-aria only honours a hover once it has seen the pointer move (interaction modality).
    fireEvent.mouseMove(logo);
    fireEvent.mouseEnter(logo);
    await act(() => vi.runAllTimers());
    expect(screen.getByRole('tooltip').textContent).toBe(name);

    fireEvent.mouseLeave(logo);
    await act(() => vi.runAllTimers());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
