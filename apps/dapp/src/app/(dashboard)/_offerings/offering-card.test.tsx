// @vitest-environment jsdom
import { type AnchorHTMLAttributes, type ReactNode } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ZSMB_OFFERING } from '@/offerings/zsmb';

import OfferingCard from './offering-card';

vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/link', () => ({
  NextLink: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));
vi.mock('@zivoe/ui/core/contextual-help', () => ({
  ContextualHelp: ({ 'aria-label': label, children }: { 'aria-label': string; children: ReactNode }) => (
    <button aria-label={label}>{children}</button>
  ),
  ContextualHelpDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>
}));
vi.mock('@/components/offering-icons', () => ({
  AcceptedChainIcons: () => null,
  AcceptedStablecoinIcons: () => null
}));
vi.mock('@/components/offering-identity', () => ({
  default: ({ offering }: { offering: { name: string } }) => <p>{offering.name}</p>,
  OfferingStatusBadge: () => null
}));

describe('OfferingCard', () => {
  afterEach(cleanup);

  it('shows the Target APY disclosure without nesting its trigger inside the card link', () => {
    render(<OfferingCard offering={ZSMB_OFFERING} nav={112000} />);

    const disclosureTrigger = screen.getByRole('button', { name: 'About Target APY' });

    expect(disclosureTrigger.closest('a')).toBeNull();
    expect(screen.getByText(/Target APY is a gross annualized target before fees and expenses/)).toBeTruthy();
    expect(screen.getByRole('link', { name: `View ${ZSMB_OFFERING.name}` }).getAttribute('href')).toBe(
      `/vaults/${ZSMB_OFFERING.slug}`
    );
  });
});
