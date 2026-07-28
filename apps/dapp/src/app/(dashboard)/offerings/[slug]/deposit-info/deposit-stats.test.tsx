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

  it('renders AUM and the 30-day Trailing APY with the revenue placeholder', () => {
    render(<DepositStats nav={112000} apy={5.25} />);

    expect(screen.getByText('AUM')).toBeTruthy();
    expect(screen.getByText('$112.00k')).toBeTruthy();
    expect(screen.getByText('30-day Trailing APY')).toBeTruthy();
    expect(screen.getByText('5.25%')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
  });

  it('renders a dash while the pool is younger than 30 days', () => {
    render(<DepositStats nav={112000} apy={null} />);

    expect(screen.getByText('30-day Trailing APY')).toBeTruthy();
    // APY and the always-empty Revenue box share the same placeholder character.
    expect(screen.getAllByText('-')).toHaveLength(2);
  });
});
