// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toast } from '@zivoe/ui/core/sonner';

import { type VerificationStatusView as VerificationStatusViewModel } from '@/server/verification/verification-status';

import PersonaFlow from './persona-flow';

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));
vi.mock('@zivoe/ui/core/link', () => {
  const Anchor = ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>;
  return { Link: Anchor, NextLink: Anchor };
});
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({ children, onPress, isDisabled }: { children: ReactNode; onPress?: () => void; isDisabled?: boolean }) => (
    <button type="button" onClick={onPress} disabled={isDisabled}>
      {children}
    </button>
  )
}));
vi.mock('@zivoe/ui/core/callout', () => ({
  Callout: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>
}));
// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn(), captureException: vi.fn() }));
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID: 'env_test' } }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
// The flow loads persona-react through next/dynamic; a stub that records each
// mount stands in for both. Once per mount, not per render: persona-react
// reads its props when it sets the iframe up, so a new token needs a remount.
const persona = vi.hoisted(() => ({ mounts: [] as Array<Record<string, unknown>> }));
vi.mock('next/dynamic', async () => {
  const { useRef } = await import('react');
  return {
    default: () => (props: Record<string, unknown>) => {
      const recorded = useRef(false);
      if (!recorded.current) {
        recorded.current = true;
        persona.mounts.push(props);
      }
      return <div data-testid="persona-frame" />;
    }
  };
});

const STORAGE_KEY = 'persona-session:inq_1';

const view = (overrides: Partial<VerificationStatusViewModel>): VerificationStatusViewModel => ({
  status: 'in_progress',
  path: 'individual',
  canStart: false,
  startedBy: null,
  canResume: true,
  inquiryId: 'inq_1',
  caseWaitingOn: null,
  ...overrides
});

const lastMount = () =>
  persona.mounts.at(-1) as {
    inquiryId: string;
    sessionToken: string;
    onComplete: () => void;
    onError: (error: { code: string; status?: number }) => void;
  };

const fetchMock = vi.fn();
/** The start route handing out a session. */
const serverSession = (sessionToken: string) =>
  fetchMock.mockResolvedValueOnce({
    status: 200,
    json: async () => ({ success: true, data: { inquiryId: 'inq_1', sessionToken } })
  });

/** Ticks what the checklist asks for that is not ticked yet: Start and Continue wait on all of it. */
const tickAll = () => {
  for (const box of screen.queryAllByRole<HTMLInputElement>('checkbox')) if (!box.checked) fireEvent.click(box);
};
const pressContinue = () => {
  tickAll();
  fireEvent.click(screen.getByRole('button', { name: 'Continue verification' }));
};

beforeEach(() => {
  persona.mounts.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  window.sessionStorage.clear();
  router.refresh.mockClear();
  router.push.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PersonaFlow reuses the session token its tab stored', () => {
  it('mounts a Continue with the stored token and never calls the server', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);

    pressContinue();

    await screen.findByTestId('persona-frame');
    expect(lastMount()).toMatchObject({ inquiryId: 'inq_1', sessionToken: 'tok_stored' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the session the server hands out for the next Continue', async () => {
    serverSession('tok_fresh');
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);

    pressContinue();

    await screen.findByTestId('persona-frame');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastMount()).toMatchObject({ sessionToken: 'tok_fresh' });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('tok_fresh');
    // The record has an inquiry now; the re-read ends the profile step.
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('forgets a stored session Persona refuses and asks the server once', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stale');
    serverSession('tok_fresh');
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);
    pressContinue();
    await screen.findByTestId('persona-frame');

    act(() => lastMount().onError({ code: 'unauthenticated', status: 409 }));

    await waitFor(() => expect(lastMount().sessionToken).toBe('tok_fresh'));
    // A remount, not a re-render: persona-react only reads a token when it mounts.
    expect(persona.mounts).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('tok_fresh');

    // A fresh session refused the same way is an error, not another resume.
    act(() => lastMount().onError({ code: 'unauthenticated', status: 409 }));
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forgets a stored session on any hard error, so the next Continue reaches the server', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);
    pressContinue();
    await screen.findByTestId('persona-frame');

    act(() => lastMount().onError({ code: 'application_error', status: 0 }));

    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong');
    // One way to try again: the Continue button, not a second Retry beside it.
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue verification' })).toBeTruthy();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-reads the view when the tab comes back into view, so a Continue acts on the present', () => {
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('polls the view after a completion, for two minutes, then rests', () => {
    vi.useFakeTimers();
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
      render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);
      pressContinue();
      act(() => lastMount().onComplete());
      router.refresh.mockClear();

      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(router.refresh).toHaveBeenCalledTimes(1);

      // 24 ticks fit in the window; the one after it clears the interval.
      act(() => {
        vi.advanceTimersByTime(120_000);
      });
      expect(router.refresh).toHaveBeenCalledTimes(24);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(router.refresh).toHaveBeenCalledTimes(24);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling once the record has moved past the submission, but still re-reads when the tab comes back', () => {
    vi.useFakeTimers();
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
      const { rerender } = render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);
      pressContinue();
      act(() => lastMount().onComplete());
      router.refresh.mockClear();

      rerender(
        <PersonaFlow
          countryCode="RO"
          subjectId="user_1"
          view={view({ status: 'pending_review', canResume: false, inquiryId: null })}
        />
      );
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(router.refresh).not.toHaveBeenCalled();
      // A review can change what it waits on days later, and a decision may have landed.
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(router.refresh).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets the session on completion', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);
    pressContinue();
    await screen.findByTestId('persona-frame');

    act(() => lastMount().onComplete());

    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
  });

  it('always resumes an expired inquiry through the server, whatever the tab stored', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
    serverSession('tok_fresh');
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({ status: 'expired' })} />);

    pressContinue();

    await screen.findByTestId('persona-frame');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastMount()).toMatchObject({ sessionToken: 'tok_fresh' });
  });
});

describe('PersonaFlow asks for the documents first', () => {
  const notStarted = () => view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null });
  const checklist = () => screen.getByRole('group', { name: "What you'll need" });
  const names = () =>
    screen
      .getAllByRole('checkbox')
      .map((box) => document.getElementById(box.getAttribute('aria-labelledby')!)!.textContent);
  const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

  it('lists what a person needs under its own heading, and answers an early Start on the first unticked item', () => {
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={notStarted()} />);

    expect(screen.getByRole('heading', { name: 'Prepare your documents' })).toBeTruthy();
    expect(checklist()).toBeTruthy();
    expect(names()).toEqual(['Photo ID', 'Device with a camera']);
    expect(button('Verify identity').disabled).toBe(false);

    const [photoId, camera] = screen.getAllByRole<HTMLInputElement>('checkbox');
    fireEvent.click(photoId!);
    fireEvent.click(button('Verify identity'));

    // Nothing starts: the unticked item is marked and focused, and the checklist says why.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Please confirm you have everything ready to continue.');
    expect(document.activeElement).toBe(camera);
    expect(camera!.getAttribute('aria-describedby')).toContain('requirements-unticked');
    expect(photoId!.getAttribute('aria-describedby')).not.toContain('requirements-unticked');

    // Ticking the last one clears it.
    fireEvent.click(camera!);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks a U.S. person for an accreditation document too, linking the attestation letter only', () => {
    render(<PersonaFlow countryCode="US" subjectId="user_1" view={notStarted()} />);

    expect(names()).toEqual(['Photo ID', 'Device with a camera', 'Accreditation document']);
    expect(screen.getByRole('link', { name: 'Attestation Letter' }).getAttribute('href')).toBe(
      '/documents/accreditation-letter.pdf'
    );
    expect(screen.queryByRole('link', { name: 'Other Documents' })).toBeNull();
    expect(screen.getByText(/proving you are an Accredited Investor/)).toBeTruthy();
  });

  it("lists an organization's needs by where it is incorporated", () => {
    const { unmount } = render(
      <PersonaFlow countryCode="DE" subjectId="org_1" view={{ ...notStarted(), path: 'organization' }} />
    );
    expect(names()).toEqual([
      'Business Address',
      'Tax Identification Number (TIN)',
      'Ultimate Beneficial Owners (UBOs)',
      'Formation Document'
    ]);
    unmount();

    render(<PersonaFlow countryCode="PR" subjectId="org_1" view={{ ...notStarted(), path: 'organization' }} />);
    expect(names()).toEqual([
      'Business Address',
      'Employer Identification Number (EIN)',
      'Ultimate Beneficial Owners (UBOs)',
      'Formation Document',
      'Accreditation Document'
    ]);
    expect(screen.getByText(/proving your entity is an Accredited Investor/)).toBeTruthy();
  });

  it('asks again on a resume, with what the record says above the button', () => {
    render(<PersonaFlow countryCode="RO" subjectId="user_1" view={view({})} />);

    expect(screen.getByRole('heading', { name: 'Prepare your documents' })).toBeTruthy();
    expect(screen.getByText(/Pick up where you left off/)).toBeTruthy();
    expect(screen.getAllByRole<HTMLInputElement>('checkbox').every((box) => !box.checked)).toBe(true);
  });

  it('renders a state with nothing to do as the status card alone, under the verification heading', () => {
    render(
      <PersonaFlow
        countryCode="RO"
        subjectId="user_1"
        view={view({ status: 'submitted', canStart: false, canResume: false, inquiryId: null })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Identity verification' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Verification processing' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: "What you'll need" })).toBeNull();
    expect(screen.queryByRole('button', { name: /verif/i })).toBeNull();
  });

  it('tells someone removed from the organization so, and re-reads the page, when a start finds them gone', async () => {
    fetchMock.mockResolvedValueOnce({ status: 404, json: async () => ({ error: 'Not found', code: 'not_member' }) });
    render(<PersonaFlow countryCode="RO" subjectId="org_1" view={{ ...notStarted(), path: 'organization' }} />);

    tickAll();
    fireEvent.click(button('Verify organization'));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/no longer a member/) })
      )
    );
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('sends a start without accepted agreements back to that step', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ error: 'Agreements not accepted', code: 'agreements_required' })
    });
    render(<PersonaFlow countryCode="RO" subjectId="org_1" view={{ ...notStarted(), path: 'organization' }} />);

    tickAll();
    fireEvent.click(button('Verify organization'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/verification?subject=org_1&step=agreements'));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/agreements/) }));
  });
});

describe('PersonaFlow start answers another click cannot change yet', () => {
  const answer = (status: number, body: object, retryAfter: string | null = null) =>
    fetchMock.mockResolvedValueOnce({ status, headers: { get: () => retryAfter }, json: async () => body });
  const pressStart = async () => {
    tickAll();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    });
  };
  const startButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Verify identity' });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rests the button, without a Retry, while Persona is unavailable', async () => {
    answer(503, { error: 'Identity verification is temporarily unavailable', code: 'persona_unavailable' });
    render(
      <PersonaFlow
        countryCode="RO"
        subjectId="user_1"
        view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })}
      />
    );

    await pressStart();

    expect(screen.getByText(/temporarily unavailable/)).toBeTruthy();
    expect(startButton().disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(startButton().disabled).toBe(false);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('rests the button for the Retry-After of a rate-limited start', async () => {
    answer(429, { error: 'The request has been rate limited.' }, '120');
    render(
      <PersonaFlow
        countryCode="RO"
        subjectId="user_1"
        view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })}
      />
    );

    await pressStart();

    expect(screen.getByText(/Too many attempts/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(119_000);
    });
    expect(startButton().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(startButton().disabled).toBe(false);
  });

  it('sends a start that finds the session gone to sign-in, with the way back to their own plain page', async () => {
    answer(401, { error: 'Unauthorized' });
    render(
      <PersonaFlow
        countryCode="RO"
        subjectId="7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b"
        view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })}
      />
    );

    await pressStart();

    expect(router.push).toHaveBeenCalledWith('/sign-in?next=%2Fverification');
  });

  it("shows the page's own words for a server fault, never the server's", async () => {
    answer(500, { error: 'Error starting identity verification' });
    render(
      <PersonaFlow
        countryCode="RO"
        subjectId="user_1"
        view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })}
      />
    );

    await pressStart();

    expect(screen.getByRole('alert').textContent).toBe('Could not start verification. Please try again.');
  });

  it('drops the refusal callout once the refreshed card names the state', async () => {
    answer(409, { error: 'Identity verification cannot be started', code: 'already_verified' });
    const { rerender } = render(
      <PersonaFlow
        countryCode="RO"
        subjectId="user_1"
        view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })}
      />
    );

    await pressStart();
    expect(screen.getByText(/already verified/)).toBeTruthy();

    rerender(
      <PersonaFlow
        countryCode="RO"
        subjectId="user_1"
        view={view({ status: 'approved', canStart: false, canResume: false, inquiryId: null })}
      />
    );
    expect(screen.queryByText(/already verified/)).toBeNull();
    expect(screen.getByText('Your identity is verified.')).toBeTruthy();
  });
});
