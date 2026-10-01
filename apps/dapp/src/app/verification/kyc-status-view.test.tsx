// @vitest-environment jsdom
import { type AnchorHTMLAttributes, type ReactNode } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type KycStatusView as KycStatusViewModel } from '@/server/kyc/kyc-status';

import { KycStatusView } from './kyc-status-view';

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));
vi.mock('@zivoe/ui/core/link', () => ({
  Link: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));
const view = (overrides: Partial<KycStatusViewModel>): KycStatusViewModel => ({
  status: 'not_started',
  path: 'individual',
  canStart: true,
  canResume: false,
  inquiryId: null,
  attemptCount: 0,
  ...overrides
});

describe('KycStatusView', () => {
  afterEach(cleanup);

  // Start and Continue are the page's own action card (see kyc-flow.test.tsx);
  // the states that reach this card are the ones with nothing to do, and none
  // of them carries a link.
  it.each([
    ['submitted', view({ status: 'submitted', canStart: false }), 'Verification processing'],
    ['failed', view({ status: 'failed', canStart: false, attemptCount: 1 }), 'Verification processing'],
    ['pending_review', view({ status: 'pending_review', canStart: false }), 'Verification under review']
  ] as const)('renders %s with its title and no link', (_label, statusView, title) => {
    render(<KycStatusView view={statusView} />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it.each([
    ['declined', view({ status: 'declined', canStart: false }), 'Verification declined', 'Contact support'],
    ['revoked', view({ status: 'revoked', canStart: false }), 'Verification revoked', 'Contact support'],
    [
      'an organization',
      view({ path: 'organization', canStart: false }),
      'Verify your organization',
      'Contact the team'
    ],
    [
      'a revoked organization',
      view({ path: 'organization', status: 'revoked', canStart: false }),
      'Verification revoked',
      'Contact the team'
    ],
    [
      'a declined organization',
      view({ path: 'organization', status: 'declined', canStart: false }),
      'We were unable to verify your organization. Our team can tell you what happens next.',
      'Contact the team'
    ]
  ] as const)('sends %s to the team with the one link it carries', (_label, statusView, title, link) => {
    render(<KycStatusView view={statusView} />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByRole('link', { name: link }).getAttribute('href')).toBe('mailto:inquire@zivoe.com');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it.each([
    ['approved', view({ status: 'approved', canStart: false }), 'Your identity is verified.'],
    ['manually_approved', view({ status: 'manually_approved', canStart: false }), 'Your identity is verified.'],
    [
      'an approved organization',
      view({ path: 'organization', status: 'approved', canStart: false }),
      'Your organization is verified.'
    ]
  ] as const)('renders %s as the compact Verified badge with no link', (_label, statusView, body) => {
    render(<KycStatusView view={statusView} />);

    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('never says Zivoe Vault or Centrifuge in user-facing copy', () => {
    const { container } = render(<KycStatusView view={view({})} />);

    expect(container.textContent).not.toMatch(/Zivoe Vault|Centrifuge/);
  });
});
