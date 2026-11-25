// @vitest-environment jsdom
import { type ReactNode, forwardRef } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteTeamForm } from './invite-team-form';

const mocks = vi.hoisted(() => ({ inviteMembers: vi.fn(), toast: vi.fn() }));

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: mocks.toast }));
vi.mock('@zivoe/ui/core/callout', () => ({
  Callout: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>
}));
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
// The field's contract, in a plain input: its name, its value, its reason and what sits at its end.
vi.mock('@zivoe/ui/core/input', () => ({
  Input: forwardRef<
    HTMLInputElement,
    {
      'aria-label': string;
      value?: string;
      onChange?: (value: string) => void;
      errorMessage?: ReactNode;
      endContent?: ReactNode;
    }
  >(function Input({ 'aria-label': label, value, onChange, errorMessage, endContent }, ref) {
    return (
      <div>
        <input ref={ref} aria-label={label} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
        {errorMessage ? <span>{errorMessage}</span> : null}
        {endContent}
      </div>
    );
  })
}));
vi.mock('@/server/actions/organizations', () => ({ inviteMembers: mocks.inviteMembers }));

const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';
const onDone = vi.fn();

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <InviteTeamForm organizationId={ORGANIZATION_ID} submitLabel="Continue" onDone={onDone} />
    </QueryClientProvider>
  );
}

const field = (index: number) => screen.getByLabelText<HTMLInputElement>(`Email address ${index}`);
const type = (index: number, value: string) => fireEvent.change(field(index), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
const addField = () => fireEvent.click(screen.getByRole('button', { name: /Add email/ }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inviteMembers.mockImplementation(async ({ emails }: { emails: Array<string> }) => ({
    ok: true,
    value: { results: emails.map((email) => ({ email, error: null })) }
  }));
});
afterEach(cleanup);

describe('InviteTeamForm', () => {
  it('offers Continue only once an address is entered', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);
    type(1, 'ada@example.com');
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(false);
  });

  it('sends every address, lowercased and once, then is done', async () => {
    renderForm();
    type(1, 'Ada@Example.com');
    addField();
    type(2, 'ada@example.com');
    addField();
    type(3, 'grace@example.com');

    submit();

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(mocks.inviteMembers).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      emails: ['ada@example.com', 'grace@example.com']
    });
  });

  it('holds an invalid address with its reason, sends nothing, and focuses it', () => {
    renderForm();
    type(1, 'ada@example.com');
    addField();
    type(2, 'not-an-email');

    submit();

    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    expect(mocks.inviteMembers).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field(2));
  });

  it('keeps only the refused addresses, each with its reason, and is not done', async () => {
    mocks.inviteMembers.mockResolvedValue({
      ok: true,
      value: {
        results: [
          { email: 'ada@example.com', error: null },
          { email: 'grace@example.com', error: 'already_invited' }
        ]
      }
    });
    renderForm();
    type(1, 'ada@example.com');
    addField();
    type(2, 'grace@example.com');

    submit();

    await screen.findByText('Already invited.');
    expect(field(1).value).toBe('grace@example.com');
    expect(screen.queryByLabelText('Email address 2')).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith({ type: 'success', title: 'Invitation sent to ada@example.com' });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('stops adding fields at ten, what one invite may carry', () => {
    renderForm();
    for (let count = 1; count < 10; count += 1) addField();

    expect(field(10)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add email/ })).toBeNull();
  });
});
