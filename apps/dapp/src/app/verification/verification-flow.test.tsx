// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type InvestorProfile } from '@/server/data/investor-profile';
import { type VerificationStatusView } from '@/server/verification/verification-status';

import { type SubjectOption } from './account-switcher';
import VerificationFlow from './verification-flow';
import { type VerificationStepId } from './verification-steps';

const mocks = vi.hoisted(() => ({
  updateInvestorProfile: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  acceptAgreements: vi.fn(),
  toast: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn()
}));

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
// The checkbox styles itself with `labelVariants`; the class names are not under test.
vi.mock('@zivoe/ui/core/field/label', () => ({
  Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  labelVariants: () => ''
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
vi.mock('@zivoe/ui/core/select', () => ({ SelectTrigger: () => null }));
// The menu's contract, in plain buttons: every item is on the page, and pressing one is the menu's action.
vi.mock('@zivoe/ui/core/menu', async () => {
  const { createContext, useContext } = await import('react');
  const Action = createContext<(key: string) => void>(() => undefined);
  return {
    MenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    MenuPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    MenuSection: ({ children }: { children: ReactNode }) => <>{children}</>,
    MenuSeparator: () => <hr />,
    Menu: ({
      children,
      onAction,
      'aria-label': label
    }: {
      children: ReactNode;
      onAction?: (key: string) => void;
      'aria-label'?: string;
    }) => (
      <Action.Provider value={(key) => onAction?.(key)}>
        <div role="menu" aria-label={label}>
          {children}
        </div>
      </Action.Provider>
    ),
    MenuItem: ({ id, textValue, children }: { id: string; textValue: string; children: ReactNode }) => {
      const act = useContext(Action);
      return (
        <button type="button" role="menuitem" aria-label={textValue} onClick={() => act(id)}>
          {children}
        </button>
      );
    }
  };
});
vi.mock('@zivoe/ui/core/dialog', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    DialogContent: ({ isOpen, children }: { isOpen?: boolean; children?: ReactNode }) =>
      isOpen ? <div role="dialog">{children}</div> : null,
    DialogContentBox: Box,
    DialogHeader: Box,
    DialogTitle: Box
  };
});
// The country field, as a plain input carrying its value; the list is the combo box's to test.
vi.mock('@/components/country-combo-box', () => ({
  CountryComboBox: ({
    label,
    value,
    onChange
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: mocks.toast, Toaster: () => null }));
vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn(), captureException: vi.fn() }));
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID: 'env_test' } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="persona-frame" /> }));
vi.mock('@/server/actions/investor-profile', () => ({ updateInvestorProfile: mocks.updateInvestorProfile }));
vi.mock('@/server/actions/organizations', () => ({
  createOrganization: mocks.createOrganization,
  updateOrganization: mocks.updateOrganization
}));
vi.mock('@/server/actions/agreements', () => ({ acceptAgreements: mocks.acceptAgreements }));
// The Wallets step has its own suite; here it only has to be the step the flow lands on.
vi.mock('./wallet-link-step', () => ({
  WalletLinkStep: ({ subjectId }: { subjectId: string }) => <div data-testid="wallets-step">{subjectId}</div>
}));

const USER_ID = '6d3f4b1e-2b7a-4a10-9a51-0f1b2c3d4e5f';
const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';

const view = (overrides: Partial<VerificationStatusView> = {}): VerificationStatusView => ({
  status: 'not_started',
  path: 'individual',
  canStart: true,
  canResume: false,
  inquiryId: null,
  caseWaitingOn: null,
  startedBy: null,
  ...overrides
});

const profile: InvestorProfile = {
  firstName: 'Zivoe',
  lastName: 'Agent',
  countryOfResidence: 'RO',
  email: 'alex+agent@zivoe.com'
};

const person = (overrides: Partial<VerificationStatusView> = {}): SubjectOption => ({
  id: USER_ID,
  name: 'Zivoe Agent',
  view: view(overrides),
  organization: null
});

const company = (overrides: Partial<VerificationStatusView> = {}): SubjectOption => ({
  id: ORGANIZATION_ID,
  name: 'Acme Capital LLC',
  view: view({ path: 'organization', ...overrides }),
  organization: { name: 'Acme Capital LLC', countryOfIncorporation: 'US', title: 'Partner' }
});

function renderFlow({
  subjects = [person()],
  activeId = USER_ID,
  step = 'profile',
  hasAcceptedAgreements = false
}: {
  subjects?: Array<SubjectOption>;
  activeId?: string;
  step?: VerificationStepId;
  hasAcceptedAgreements?: boolean;
} = {}) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <VerificationFlow
        subjects={subjects}
        activeId={activeId}
        step={step}
        hasAcceptedAgreements={hasAcceptedAgreements}
        profile={profile}
      />
    </QueryClientProvider>
  );
}

const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
/** The desktop rail; the mobile one repeats it. */
const rail = () => screen.getAllByRole('list', { name: 'Verification steps' })[0]!;
const stepItem = (label: string) => within(rail()).getByText(label).closest('li')!;
const pressContinue = () => fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
/** The desktop rail's switcher; the mobile one repeats it. */
const switcher = () => screen.getAllByRole('button', { name: /^Verifying as/ })[0]!;
const menuItem = (name: string) => screen.getAllByRole('menuitem', { name })[0]!;
const toStep = (subjectId: string, step: 'details' | 'agreements' | 'identity') =>
  subjectId === USER_ID ? `/verification?step=${step}` : `/verification?subject=${subjectId}&step=${step}`;
/** Ticks the checklist before the Persona flow: Start waits on all of it. */
const tickAll = () => {
  for (const box of screen.queryAllByRole<HTMLInputElement>('checkbox')) if (!box.checked) fireEvent.click(box);
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateInvestorProfile.mockResolvedValue({ success: true });
  mocks.updateOrganization.mockResolvedValue({ ok: true, value: undefined });
  mocks.createOrganization.mockResolvedValue({ ok: true, value: { organizationId: ORGANIZATION_ID } });
  mocks.acceptAgreements.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe('step one: account details', () => {
  it('prefills the person, with the email locked, and saves before moving on through the URL', async () => {
    renderFlow();

    expect(field('First Name').value).toBe('Zivoe');
    expect(field('Email').readOnly).toBe(true);
    expect(stepItem('Account details').getAttribute('aria-current')).toBe('step');

    fireEvent.change(field('First Name'), { target: { value: 'Ada' } });
    pressContinue();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(toStep(USER_ID, 'agreements')));
    expect(mocks.updateInvestorProfile).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Agent',
      countryOfResidence: 'RO'
    });
  });

  it('refuses an empty first name before asking the server', async () => {
    renderFlow();

    fireEvent.change(field('First Name'), { target: { value: ' ' } });
    pressContinue();

    await screen.findByText('First name is required');
    expect(mocks.updateInvestorProfile).not.toHaveBeenCalled();
  });

  it('stays on the step, with a toast, when the server refuses the save', async () => {
    mocks.updateInvestorProfile.mockResolvedValue({ error: 'Your details can no longer be changed here.' });
    renderFlow();

    pressContinue();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("saves an organization's details while it can still start, and only when they changed", async () => {
    renderFlow({ subjects: [person(), company()], activeId: ORGANIZATION_ID });

    expect(field('Legal Name').value).toBe('Acme Capital LLC');
    pressContinue();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(toStep(ORGANIZATION_ID, 'agreements')));
    expect(mocks.updateOrganization).not.toHaveBeenCalled();

    fireEvent.change(field('Legal Name'), { target: { value: 'Acme Capital Ltd' } });
    pressContinue();
    await waitFor(() =>
      expect(mocks.updateOrganization).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        details: { name: 'Acme Capital Ltd', countryOfIncorporation: 'US', title: 'Partner' }
      })
    );
  });

  it('shows the details read-only once the verification can no longer start, and saves nothing', async () => {
    renderFlow({
      subjects: [person(), company({ status: 'pending_review', canStart: false })],
      activeId: ORGANIZATION_ID
    });

    expect(field('Legal Name').readOnly).toBe(true);
    pressContinue();

    expect(mocks.push).toHaveBeenCalledWith(toStep(ORGANIZATION_ID, 'agreements'));
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });
});

describe('the account switcher', () => {
  it('names who is being verified, as an individual or an organization', () => {
    renderFlow({ subjects: [person(), company()], activeId: ORGANIZATION_ID, step: 'identity' });

    expect(switcher().getAttribute('aria-label')).toBe(
      'Verifying as Acme Capital LLC, Organization · KYB. Switch account'
    );
    expect(within(switcher()).getByText('Organization · KYB')).toBeTruthy();
  });

  it('switches to another account through the URL, and stays put on the current one', () => {
    renderFlow({ subjects: [person(), company()], activeId: ORGANIZATION_ID, step: 'identity' });

    fireEvent.click(menuItem('Acme Capital LLC'));
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(menuItem('Zivoe Agent'));
    expect(mocks.push).toHaveBeenCalledWith('/verification');
  });

  it('cannot switch while a verification is starting', async () => {
    // A start that never answers holds the step in "starting".
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined))
    );
    renderFlow({ subjects: [person()], step: 'identity' });

    expect(switcher().hasAttribute('disabled')).toBe(false);
    tickAll();
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));

    await waitFor(() => expect(switcher().hasAttribute('disabled')).toBe(true));
    vi.unstubAllGlobals();
  });

  it('lets the person switch away from an open Persona form, as a refresh would', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        json: async () => ({ success: true, data: { inquiryId: 'inq_1', sessionToken: 'session_1' } })
      }))
    );
    renderFlow({ subjects: [person(), company()], step: 'identity' });

    tickAll();
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    await screen.findByTestId('persona-frame');

    await waitFor(() => expect(switcher().hasAttribute('disabled')).toBe(false));
    // The rail's way back to Account details is open again too.
    expect(within(stepItem('Account details')).getByRole('link', { name: 'Account details' })).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('creates an organization in a dialog, and goes on to verifying it', async () => {
    renderFlow();

    fireEvent.click(menuItem('Create organization'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Legal Name'), { target: { value: 'Newco Ltd' } });
    fireEvent.change(within(dialog).getByLabelText('Country Of Incorporation'), { target: { value: 'GB' } });
    fireEvent.change(within(dialog).getByLabelText('Your Job Title'), { target: { value: 'CFO' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create organization' }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(toStep(ORGANIZATION_ID, 'agreements')));
    expect(mocks.createOrganization.mock.calls[0]![0]).toEqual({
      name: 'Newco Ltd',
      countryOfIncorporation: 'GB',
      title: 'CFO'
    });
  });

  it('refuses a legal name that reads as a web address', async () => {
    renderFlow();

    fireEvent.click(menuItem('Create organization'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Legal Name'), { target: { value: 'claim-prize.example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Country Of Incorporation'), { target: { value: 'GB' } });
    fireEvent.change(within(dialog).getByLabelText('Your Job Title'), { target: { value: 'CFO' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create organization' }));

    await within(dialog).findByText(/Use letters|web address/);
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });
});

describe('the steps after it', () => {
  it('opens on the Persona step for the account picked', () => {
    renderFlow({ subjects: [person(), company()], activeId: ORGANIZATION_ID, step: 'identity' });

    expect(stepItem('Business verification').getAttribute('aria-current')).toBe('step');
  });

  it('links back to the account details and the agreements, read-only once verification has started', () => {
    renderFlow({
      subjects: [person(), company({ status: 'pending_review', canStart: false })],
      activeId: ORGANIZATION_ID,
      step: 'identity'
    });

    const details = within(stepItem('Account details')).getByRole('link', { name: 'Account details' });
    expect(details.getAttribute('href')).toBe(toStep(ORGANIZATION_ID, 'details'));
    const agreements = within(stepItem('Agreements')).getByRole('link', { name: 'Agreements' });
    expect(agreements.getAttribute('href')).toBe(toStep(ORGANIZATION_ID, 'agreements'));
    expect(screen.getByText('Step 3 of 4')).toBeTruthy();
  });

  it('goes back from the Persona step to the agreements while it can still start', () => {
    renderFlow({ step: 'identity' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(mocks.push).toHaveBeenCalledWith(toStep(USER_ID, 'agreements'));
  });

  it('tells a member whose colleague is running the inquiry that it is theirs to finish', () => {
    renderFlow({
      subjects: [
        person(),
        company({
          status: 'in_progress',
          canStart: false,
          canResume: false,
          startedBy: { name: 'Jane Doe', isViewer: false, at: new Date('2026-11-03T10:00:00Z') }
        })
      ],
      activeId: ORGANIZATION_ID,
      step: 'identity'
    });

    expect(screen.getByText('Jane Doe started this on 3 Nov. Only Jane Doe can continue it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^(Verify |Continue|Start)/ })).toBeNull();
  });

  it('offers a fresh start when an earlier attempt has nothing left to go back to', () => {
    renderFlow({
      subjects: [person(), company({ status: 'expired', canStart: false, canResume: true, inquiryId: null })],
      activeId: ORGANIZATION_ID,
      step: 'identity'
    });

    expect(screen.getByText(/Starting again begins a new verification/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify organization' })).toBeTruthy();
  });

  it('shows Wallets for the subject picked, with every step before it done', () => {
    renderFlow({
      subjects: [person(), company({ status: 'approved', canStart: false })],
      activeId: ORGANIZATION_ID,
      step: 'wallets'
    });

    expect(screen.getByTestId('wallets-step').textContent).toBe(ORGANIZATION_ID);
    expect(stepItem('Wallets').getAttribute('aria-current')).toBe('step');
    for (const label of ['Account details', 'Agreements', 'Business verification']) {
      expect(within(stepItem(label)).getByText(', completed')).toBeTruthy();
    }
  });

  it("holds an organization's no on the business step, with step one done", () => {
    renderFlow({
      subjects: [person(), company({ status: 'declined', canStart: false })],
      activeId: ORGANIZATION_ID,
      step: 'identity'
    });

    expect(screen.getByRole('status').textContent).toMatch(/Verification declined/);
    expect(within(stepItem('Account details')).getByText(', completed')).toBeTruthy();
    expect(within(stepItem('Agreements')).getByText(', completed')).toBeTruthy();
    expect(screen.queryByTestId('wallets-step')).toBeNull();
  });
});

describe('step two: the agreements', () => {
  const continueButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' });
  const agreementBox = () => screen.getByRole<HTMLInputElement>('checkbox', { name: /I have read and agree/ });

  it('links each agreement and holds Continue until the box is ticked, then records it and moves on', async () => {
    renderFlow({ subjects: [person(), company()], activeId: ORGANIZATION_ID, step: 'agreements' });

    expect(screen.getByText('Step 2 of 4')).toBeTruthy();
    expect(stepItem('Agreements').getAttribute('aria-current')).toBe('step');
    const links = within(screen.getByRole('list', { name: 'Agreements' })).getAllByRole('link');
    expect(
      links.map((link) => [link.textContent?.replace('(opens in a new tab)', ''), link.getAttribute('href')])
    ).toEqual([
      ['Master Lending Agreement', '/documents/master-lending-agreement.pdf'],
      ['Confidential Offering Memorandum', '/documents/confidential-offering-memorandum.pdf'],
      ['Offering Supplement', '/documents/offering-supplement.pdf']
    ]);
    expect(continueButton().disabled).toBe(true);

    fireEvent.click(agreementBox());
    fireEvent.click(continueButton());

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(toStep(ORGANIZATION_ID, 'identity')));
    expect(mocks.acceptAgreements).toHaveBeenCalledWith({ subjectId: ORGANIZATION_ID });
  });

  it('shows an earlier acceptance ticked and locked, and moves on without recording it again', () => {
    renderFlow({ step: 'agreements', hasAcceptedAgreements: true });

    expect(agreementBox().checked).toBe(true);
    expect(agreementBox().disabled).toBe(true);

    fireEvent.click(continueButton());
    expect(mocks.push).toHaveBeenCalledWith(toStep(USER_ID, 'identity'));
    expect(mocks.acceptAgreements).not.toHaveBeenCalled();
  });

  it('stays on the step with a message when the acceptance cannot be saved', async () => {
    mocks.acceptAgreements.mockResolvedValue({ ok: false, code: 'failed' });
    renderFlow({ step: 'agreements' });

    fireEvent.click(agreementBox());
    fireEvent.click(continueButton());

    expect((await screen.findByRole('alert')).textContent).toBe('Could not save your agreement. Please try again.');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('tells someone removed from the organization so, and re-reads the page', async () => {
    mocks.acceptAgreements.mockResolvedValue({ ok: false, code: 'not_member' });
    renderFlow({ subjects: [person(), company()], activeId: ORGANIZATION_ID, step: 'agreements' });

    fireEvent.click(agreementBox());
    fireEvent.click(continueButton());

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('goes back to the account details', () => {
    renderFlow({ step: 'agreements' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(mocks.push).toHaveBeenCalledWith(toStep(USER_ID, 'details'));
  });
});
