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
  TrendingIcon: () => null,
  // Pulled in by the Offerings registry, which carries the Target APY constant.
  ZMcaLogo: () => null
}));

describe('DepositStats', () => {
  afterEach(cleanup);

  it('renders AUM and the published Target APY with the revenue placeholder', () => {
    render(<DepositStats nav={112000} />);

    expect(screen.getByText('AUM')).toBeTruthy();
    expect(screen.getByText('$112.00k')).toBeTruthy();
    expect(screen.getByText('Target APY')).toBeTruthy();
    expect(screen.getByText('14%')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
  });
});
