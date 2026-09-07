// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ZSMB_ZIVOE_VAULT } from '@/zivoe-vaults/zsmb';

import { AcceptedChainIcons } from './zivoe-vault-icons';

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

describe('AcceptedChainIcons', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('names the chain in a tooltip while its logo is hovered', async () => {
    vi.useFakeTimers();
    render(<AcceptedChainIcons zivoeVault={ZSMB_ZIVOE_VAULT} />);

    const logo = screen.getByRole('img', { name: 'Ethereum' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    // react-aria only honours a hover once it has seen the pointer move (interaction modality).
    fireEvent.mouseMove(logo);
    fireEvent.mouseEnter(logo);
    await act(() => vi.runAllTimers());
    expect(screen.getByRole('tooltip').textContent).toBe('Ethereum');

    fireEvent.mouseLeave(logo);
    await act(() => vi.runAllTimers());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
