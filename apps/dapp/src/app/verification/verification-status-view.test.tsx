// @vitest-environment jsdom
import { type AnchorHTMLAttributes, type ReactNode } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VerificationStatusView as VerificationStatusViewModel } from '@/server/verification/verification-status';

import { VerificationStatusView } from './verification-status-view';

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
const view = (overrides: Partial<VerificationStatusViewModel>): VerificationStatusViewModel => ({
  status: 'not_started',
  path: 'individual',
  canStart: true,
  canResume: false,
  inquiryId: null,
  caseWaitingOn: null,
  ...overrides
});

describe('VerificationStatusView', () => {
  afterEach(cleanup);

  // Start and Continue are the page's own action card (see persona-flow.test.tsx);
  // the states that reach this card are the ones with nothing to do, and none
  // of them carries a link.
  it.each([
    ['submitted', view({ status: 'submitted', canStart: false }), 'Verification processing'],
    ['failed', view({ status: 'failed', canStart: false }), 'Verification processing'],
    ['pending_review', view({ status: 'pending_review', canStart: false }), 'Verification under review']
  ] as const)('renders %s with its title and no link', (_label, statusView, title) => {
    render(<VerificationStatusView view={statusView} />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it.each([
    ['declined', view({ status: 'declined', canStart: false }), 'Verification declined', 'Contact support'],
    ['revoked', view({ status: 'revoked', canStart: false }), 'Verification revoked', 'Contact support'],
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
    render(<VerificationStatusView view={statusView} />);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByRole('link', { name: link }).getAttribute('href')).toBe('mailto:inquire@zivoe.com');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it.each([
    [
      'waiting on its owners',
      view({ path: 'organization', status: 'pending_review', canStart: false, caseWaitingOn: 'people' }),
      /owners and control person you listed/
    ],
    [
      'waiting on the team',
      view({ path: 'organization', status: 'pending_review', canStart: false, caseWaitingOn: 'team' }),
      /member of our team is reviewing/
    ],
    ['processing', view({ path: 'organization', status: 'submitted', canStart: false }), /opening the review/]
  ] as const)('tells an organization %s what the review waits on, with no link', (_label, statusView, body) => {
    render(<VerificationStatusView view={statusView} />);

    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('sends a failed organization to the team: no restart, one link', () => {
    render(<VerificationStatusView view={view({ path: 'organization', status: 'failed', canStart: false })} />);

    expect(screen.getByText('Verification could not be completed')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Contact the team' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  // A yes Decision lands on the Wallets step, so this card only ever shows a yes that is not one yet (a stale render).
  it('renders an approved organization as the compact Verified badge with no link', () => {
    render(<VerificationStatusView view={view({ path: 'organization', status: 'approved', canStart: false })} />);

    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Your organization is verified.')).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('never says Zivoe Vault or Centrifuge in user-facing copy', () => {
    const { container } = render(<VerificationStatusView view={view({})} />);

    expect(container.textContent).not.toMatch(/Zivoe Vault|Centrifuge/);
  });
});
