// @vitest-environment jsdom
import { type ReactNode, createContext, forwardRef, useContext } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingForm from './onboarding-form';

const mocks = vi.hoisted(() => ({ completeOnboarding: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/server/actions/onboarding', () => ({ completeOnboarding: mocks.completeOnboarding }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));
vi.mock('@zivoe/ui/core/link', () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock('@zivoe/ui/core/field/label', () => ({ Label: () => null }));
vi.mock('@zivoe/ui/core/field/field-error', () => ({ FieldError: () => null }));
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({
    children,
    onPress,
    isDisabled,
    type
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    type?: 'button' | 'submit';
  }) => (
    <button type={type ?? 'button'} onClick={onPress} disabled={isDisabled}>
      {children}
    </button>
  )
}));
// Each field's contract in a plain input, named by its label: its value and what it reports.
vi.mock('@zivoe/ui/core/input', () => ({
  Input: forwardRef<HTMLInputElement, { label: string; value?: string; onChange?: (value: string) => void }>(
    function Input({ label, value, onChange }, ref) {
      return (
        <input ref={ref} aria-label={label} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
      );
    }
  )
}));
vi.mock('@/components/country-combo-box', () => ({
  CountryComboBox: ({
    label,
    value,
    onChange
  }: {
    label: string;
    value?: string;
    onChange: (value: string) => void;
  }) => <input aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
}));
vi.mock('@zivoe/ui/core/select', () => ({
  Select: ({
    'aria-label': label,
    value,
    onChange
  }: {
    'aria-label': string;
    value?: string;
    onChange: (value: string) => void;
  }) => <input aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectPopover: () => null,
  SelectListBox: () => null,
  SelectItem: () => null
}));
vi.mock('@zivoe/ui/core/radio', () => {
  const Choose = createContext<(value: string) => void>(() => undefined);
  return {
    RadioGroup: ({ children, onChange }: { children: ReactNode; onChange: (value: string) => void }) => (
      <Choose.Provider value={onChange}>{children}</Choose.Provider>
    ),
    Radio: function Radio({ children, value }: { children: ReactNode; value: string }) {
      const choose = useContext(Choose);
      return (
        <button type="button" onClick={() => choose(value)}>
          {children}
        </button>
      );
    }
  };
});
vi.mock('@/components/invite-team-form', () => ({
  InviteTeamForm: ({ organizationId }: { organizationId: string }) => <p>Inviting to {organizationId}</p>
}));

const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';
const PROFILE = {
  firstName: 'Zivoe',
  lastName: 'Agent',
  countryOfResidence: 'US',
  amountOfInterest: '10k_100k',
  referralSource: 'other'
};
const ORGANIZATION = { name: 'Acme Capital LLC', countryOfIncorporation: 'US', title: 'Partner' };

const PROFILE_FIELDS = {
  firstName: 'First Name',
  lastName: 'Last Name',
  countryOfResidence: 'Country Of Residence',
  amountOfInterest: 'Amount of Interest',
  referralSource: 'How did you find Zivoe'
} as const;
const ORGANIZATION_FIELDS = {
  name: 'Legal Name',
  countryOfIncorporation: 'Country Of Incorporation',
  title: 'Your Job Title'
} as const;

function renderForm({ canInvestThroughOrganization = true } = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <OnboardingForm canInvestThroughOrganization={canInvestThroughOrganization} />
    </QueryClientProvider>
  );
}

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const heading = () => screen.getByRole('heading').textContent;
// The form validates before it moves on, so the next step shows a tick later.
const findHeading = (name: string) => screen.findByRole('heading', { name });
const fill = (fields: Record<string, string>, values: Record<string, string>) =>
  Object.entries(fields).forEach(([key, label]) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value: values[key] } })
  );
const valueOf = (label: string) => screen.getByLabelText<HTMLInputElement>(label).value;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completeOnboarding.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe('OnboardingForm', () => {
  it('asks how they will invest first, and saves only their own answers for "Just me"', async () => {
    renderForm();
    expect(heading()).toBe('How Will You Invest?');

    press('Just me');
    press('Continue');
    expect(heading()).toBe('Tell Us About Yourself');
    fill(PROFILE_FIELDS, PROFILE);
    press('Continue');

    await waitFor(() => expect(mocks.completeOnboarding).toHaveBeenCalledWith({ profile: PROFILE }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/'));
  });

  it('goes from their own answers to the organization, saves both at once, then asks who else joins', async () => {
    mocks.completeOnboarding.mockResolvedValue({ success: true, organizationId: ORGANIZATION_ID });
    renderForm();

    press('Through an organization');
    press('Continue');
    fill(PROFILE_FIELDS, PROFILE);
    press('Continue');
    await findHeading('About Your Organization');
    fill(ORGANIZATION_FIELDS, ORGANIZATION);
    press('Continue');

    await waitFor(() => expect(screen.getByText(`Inviting to ${ORGANIZATION_ID}`)).toBeTruthy());
    expect(mocks.completeOnboarding).toHaveBeenCalledWith({ profile: PROFILE, organization: ORGANIZATION });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('keeps the choice and everything typed, valid or not, when they step back', async () => {
    renderForm();

    press('Through an organization');
    press('Continue');
    fill(PROFILE_FIELDS, PROFILE);
    press('Continue');
    await findHeading('About Your Organization');
    fireEvent.change(screen.getByLabelText('Legal Name'), { target: { value: 'Acme' } });
    press('Back');
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: '' } });
    press('Back');

    expect(heading()).toBe('How Will You Invest?');
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(false);
    press('Continue');
    expect(valueOf('First Name')).toBe('');
    expect(valueOf('Last Name')).toBe(PROFILE.lastName);
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: PROFILE.firstName } });
    press('Continue');
    await findHeading('About Your Organization');
    expect(valueOf('Legal Name')).toBe('Acme');
  });

  it('asks an invitee only for their own answers, with no way back to a choice', async () => {
    renderForm({ canInvestThroughOrganization: false });
    expect(heading()).toBe('Tell Us About Yourself');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    fill(PROFILE_FIELDS, PROFILE);
    press('Continue');

    await waitFor(() => expect(mocks.completeOnboarding).toHaveBeenCalledWith({ profile: PROFILE }));
  });
});
