// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DepositStats from './deposit-stats';

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@/components/info-section', () => ({
  default: ({ children }: { children: ReactNode }) => <section>{children}</section>
}));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
// The real popover renders its content only once opened; the mock renders it
// inline so the assertions can read the disclosure copy itself.
vi.mock('@zivoe/ui/core/contextual-help', () => ({
  ContextualHelp: ({ 'aria-label': label, children }: { 'aria-label': string; children: ReactNode }) => (
    <button aria-label={label}>{children}</button>
  ),
  ContextualHelpDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>
}));

describe('DepositStats', () => {
  afterEach(cleanup);

  it('renders NAV, the Zivoe Vault Target APY and the Token Price', () => {
    render(<DepositStats nav={112000} sharePrice={1.0725} targetApyPercent={14} />);

    expect(screen.getByText('NAV')).toBeTruthy();
    // Full amount, no k/M suffix, truncated to whole dollars.
    expect(screen.getByText('$112,000')).toBeTruthy();
    expect(screen.getByText('Target APY')).toBeTruthy();
    expect(screen.getByText('14%')).toBeTruthy();
    // The Target APY number never renders without its disclosure.
    expect(screen.getByLabelText('About Target APY')).toBeTruthy();
    expect(screen.getByText(/Target APY is a gross annualized target before fees and expenses/)).toBeTruthy();
    expect(screen.getByText('Token Price')).toBeTruthy();
    // Up to four decimals, truncated.
    expect(screen.getByText('$1.0725')).toBeTruthy();
  });
});
