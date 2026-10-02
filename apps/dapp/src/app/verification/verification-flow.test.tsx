// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type InvestorProfile } from '@/server/data/investor-profile';
import { type KycStatusView } from '@/server/kyc/kyc-status';

import VerificationFlow from './verification-flow';

const mocks = vi.hoisted(() => ({ updateInvestorProfile: vi.fn(), toast: vi.fn(), refresh: vi.fn() }));

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/assets/zivoe-logo', () => ({ ZivoeLogo: () => null }));
vi.mock('@zivoe/ui/core/separator', () => ({ Separator: () => <hr /> }));
vi.mock('@zivoe/ui/core/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));
vi.mock('@zivoe/ui/core/callout', () => ({
  Callout: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>
}));
vi.mock('@zivoe/ui/core/link', () => {
  const Anchor = ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>;
  return { Link: Anchor, NextLink: Anchor };
});
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({
    children,
    onPress,
    isDisabled,
    isPending,
    pendingContent,
    type
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    isPending?: boolean;
    pendingContent?: ReactNode;
    type?: 'button' | 'submit';
  }) => (
    <button type={type ?? 'button'} onClick={onPress} disabled={isDisabled}>
      {isPending && pendingContent ? pendingContent : children}
    </button>
  )
}));
vi.mock('@zivoe/ui/core/field/label', () => ({
  Label: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));
vi.mock('@zivoe/ui/core/field/field-error', () => ({
  FieldError: ({ children }: { children?: ReactNode }) => (children ? <span>{children}</span> : null)
}));
// The field's contract, in a plain input: a locked field is a read-only input.
vi.mock('@zivoe/ui/core/input', () => ({
  Input: ({
    label,
    value,
    onChange,
    isReadOnly,
    errorMessage
  }: {
    label: string;
    value?: string;
    onChange?: (value: string) => void;
    isReadOnly?: boolean;
    errorMessage?: ReactNode;
  }) => (
    <label>
      {label}
      <input readOnly={isReadOnly} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
      {errorMessage ? <span>{errorMessage}</span> : null}
    </label>
  )
}));
// The select, as a plain input carrying its value; the popover internals are the UI package's to test.
vi.mock('@zivoe/ui/core/select', () => ({
  // Its children carry the field's Label; the rest of them render nothing here.
  Select: ({
    children,
    value,
    onChange
  }: {
    children: ReactNode;
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <label>
      {children}
      <input value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  ),
  SelectItem: () => null,
  SelectListBox: () => null,
  SelectPopover: () => null,
  SelectTrigger: () => null,
  SelectValue: () => null
}));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: mocks.toast, Toaster: () => null }));
vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn(), captureException: vi.fn() }));
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID: 'env_test' } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="persona-frame" /> }));
vi.mock('@/server/actions/investor-profile', () => ({ updateInvestorProfile: mocks.updateInvestorProfile }));

const view = (overrides: Partial<KycStatusView> = {}): KycStatusView => ({
  status: 'not_started',
  path: 'individual',
  canStart: true,
  canResume: false,
  inquiryId: null,
  ...overrides
});

const profile = (overrides: Partial<InvestorProfile> = {}): InvestorProfile => ({
  accountType: 'individual',
  firstName: 'Zivoe',
  lastName: 'Agent',
  countryOfResidence: 'Romania',
  email: 'alex+agent@zivoe.com',
  ...overrides
});

function renderFlow({ statusView = view(), investor = profile() } = {}) {
  const client = new QueryClient();
  const tree = (statusView: KycStatusView) => (
    <QueryClientProvider client={client}>
      <VerificationFlow view={statusView} profile={investor} />
    </QueryClientProvider>
  );
  const result = render(tree(statusView));
  return { ...result, rerenderWith: (next: KycStatusView) => result.rerender(tree(next)) };
}

/** The record once an inquiry exists but the investor can still resume it. */
const inProgress = () => view({ status: 'in_progress', canStart: false, canResume: true, inquiryId: 'inq_1' });

const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
/** The desktop rail; the mobile one repeats it. */
const rail = () => screen.getAllByRole('list', { name: 'Verification steps' })[0]!;
const stepItem = (label: string) => within(rail()).getByText(label).closest('li')!;

const pressContinue = () => fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateInvestorProfile.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe('VerificationFlow', () => {
  it('opens on the Investor profile step, prefilled, with the account type and email locked', () => {
    renderFlow();

    expect(screen.getByRole('heading', { name: 'Investor profile' })).toBeTruthy();
    expect(field('First Name').value).toBe('Zivoe');
    expect(field('Last Name').value).toBe('Agent');
    expect(field('Country Of Residence').value).toBe('Romania');
    expect(field('Account type')).toMatchObject({ value: 'Individual', readOnly: true });
    expect(field('Email')).toMatchObject({ value: 'alex+agent@zivoe.com', readOnly: true });
    expect(field('First Name').readOnly).toBe(false);

    expect(stepItem('Investor profile').getAttribute('aria-current')).toBe('step');
    expect(stepItem('Identity verification').getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'Exit' }).getAttribute('href')).toBe('/');
    // Exit is the shell's one control: nothing up there can unmount a step.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Continue']);
  });

  it('saves the confirmed details, shows the wait, then moves to the identity step', async () => {
    let finishSave!: (result: { success: true }) => void;
    mocks.updateInvestorProfile.mockReturnValue(new Promise((resolve) => (finishSave = resolve)));
    renderFlow();

    fireEvent.change(field('First Name'), { target: { value: 'Ada' } });
    pressContinue();

    await screen.findByRole('button', { name: 'Saving...' });
    expect(mocks.updateInvestorProfile).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Agent',
      countryOfResidence: 'Romania'
    });

    finishSave({ success: true });

    await screen.findByRole('heading', { name: 'Identity verification' });
    expect(screen.getByRole('button', { name: 'Verify identity' })).toBeTruthy();
    expect(stepItem('Identity verification').getAttribute('aria-current')).toBe('step');
    expect(within(stepItem('Investor profile')).getByText(', completed')).toBeTruthy();
  });

  it('refuses an empty first name before asking the server', async () => {
    renderFlow();

    fireEvent.change(field('First Name'), { target: { value: '' } });
    pressContinue();

    await screen.findByText('First name is required');
    expect(mocks.updateInvestorProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Investor profile' })).toBeTruthy();
  });

  it('stays on the step, with a toast, when the server refuses the save', async () => {
    mocks.updateInvestorProfile.mockResolvedValue({ error: 'Unauthorized' });
    renderFlow();

    pressContinue();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
    expect(screen.getByRole('heading', { name: 'Investor profile' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Identity verification' })).toBeNull();
    // The record is re-read: had a verification begun elsewhere, the page would move on to it.
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('comes back to the saved details on Back', async () => {
    renderFlow();
    fireEvent.change(field('First Name'), { target: { value: 'Ada' } });
    pressContinue();
    await screen.findByRole('heading', { name: 'Identity verification' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('heading', { name: 'Investor profile' })).toBeTruthy();
    expect(field('First Name').value).toBe('Ada');
    expect(mocks.updateInvestorProfile).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['in progress', inProgress(), 'Continue verification'],
    ['approved', view({ status: 'approved', canStart: false }), null]
  ] as const)(
    'opens on the identity step, without Back, once an inquiry exists (%s)',
    (_label, statusView, resumeButton) => {
      renderFlow({ statusView });

      expect(screen.getByRole('heading', { name: 'Identity verification' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Investor profile' })).toBeNull();
      if (resumeButton) expect(screen.getByRole('button', { name: resumeButton })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
      expect(within(stepItem('Investor profile')).getByText(', completed')).toBeTruthy();
    }
  );

  it('marks the identity step done as well once verified', () => {
    renderFlow({ statusView: view({ status: 'approved', canStart: false }) });

    expect(screen.getByText('Your identity is verified.')).toBeTruthy();
    expect(within(stepItem('Identity verification')).getByText(', completed')).toBeTruthy();
  });

  it('keeps the last step named in the phone row once every step is done', () => {
    renderFlow({ statusView: view({ status: 'approved', canStart: false }) });

    // Below `sm` only one label is visible; with no step current it is the last one, not none.
    const phoneRow = screen.getAllByRole('list', { name: 'Verification steps' })[1]!;
    expect(within(phoneRow).getByText('Identity verification').className).not.toMatch(/(^|\s)sr-only/);
    expect(within(phoneRow).getByText('Investor profile').className).toMatch(/(^|\s)sr-only/);
  });

  it('leaves the profile step the moment the record says an inquiry exists, even mid-edit', () => {
    const { rerenderWith } = renderFlow();
    fireEvent.change(field('First Name'), { target: { value: 'Ada' } });

    // Another tab's Continue created the inquiry; the tab's re-read brings it in.
    rerenderWith(inProgress());

    expect(screen.getByRole('heading', { name: 'Identity verification' })).toBeTruthy();
    expect(screen.queryByLabelText('First Name')).toBeNull();
    expect(within(stepItem('Investor profile')).getByText(', completed')).toBeTruthy();
  });

  it('locks the step for an organization and points to the team instead of a form', () => {
    renderFlow({
      statusView: view({ path: 'organization', canStart: false }),
      investor: profile({ accountType: 'organization', countryOfResidence: null })
    });

    expect(field('Account type')).toMatchObject({ value: 'Organization', readOnly: true });
    expect(screen.getByRole('link', { name: 'Contact the team' }).getAttribute('href')).toBe(
      'mailto:inquire@zivoe.com'
    );
    expect(screen.queryByLabelText('First Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Exit' }).getAttribute('href')).toBe('/');
  });

  it("shows an organization's Decision on the profile step without marking the identity step done", () => {
    renderFlow({
      statusView: view({ path: 'organization', status: 'approved', canStart: false }),
      investor: profile({ accountType: 'organization', countryOfResidence: null })
    });

    expect(screen.getByText('Your organization is verified.')).toBeTruthy();
    expect(stepItem('Investor profile').getAttribute('aria-current')).toBe('step');
    expect(within(stepItem('Identity verification')).queryByText(', completed')).toBeNull();
  });
});
