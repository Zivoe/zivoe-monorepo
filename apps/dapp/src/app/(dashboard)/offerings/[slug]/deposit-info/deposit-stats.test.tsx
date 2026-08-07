// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DepositStats from './deposit-stats';

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@/components/info-section', () => ({
  default: ({ children }: { children: ReactNode }) => <section>{children}</section>
}));
vi.mock('@zivoe/ui/icons', () => ({
  BankIcon: () => null,
  ChartIcon: () => null,
  MoneyIcon: () => null,
  TrendingIcon: () => null
}));

describe('DepositStats', () => {
  afterEach(cleanup);

  it('renders AUM, the Offering Target APY and the Token Price', () => {
    render(<DepositStats nav={112000} sharePrice={1.0725} targetApyPercent={14} />);

    expect(screen.getByText('AUM')).toBeTruthy();
    expect(screen.getByText('$112.00k')).toBeTruthy();
    expect(screen.getByText('Target APY')).toBeTruthy();
    expect(screen.getByText('14%')).toBeTruthy();
    expect(screen.getByText('Token Price')).toBeTruthy();
    // Two decimals, floored — the same treatment AUM gets.
    expect(screen.getByText('$1.07')).toBeTruthy();
  });
});
