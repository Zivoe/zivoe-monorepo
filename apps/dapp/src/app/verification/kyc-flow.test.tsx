// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type KycStatusView as KycStatusViewModel } from '@/server/kyc/kyc-status';

import KycFlow from './kyc-flow';

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

const view = (overrides: Partial<KycStatusViewModel>): KycStatusViewModel => ({
  status: 'in_progress',
  path: 'individual',
  canStart: false,
  canResume: true,
  inquiryId: 'inq_1',
  attemptCount: 1,
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

const pressContinue = () => fireEvent.click(screen.getByRole('button', { name: 'Continue verification' }));

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

describe('KycFlow reuses the session token its tab stored', () => {
  it('mounts a Continue with the stored token and never calls the server', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
    render(<KycFlow view={view({})} />);

    pressContinue();

    await screen.findByTestId('persona-frame');
    expect(lastMount()).toMatchObject({ inquiryId: 'inq_1', sessionToken: 'tok_stored' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the session the server hands out for the next Continue', async () => {
    serverSession('tok_fresh');
    render(<KycFlow view={view({})} />);

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
    render(<KycFlow view={view({})} />);
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
    render(<KycFlow view={view({})} />);
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
    render(<KycFlow view={view({})} />);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('polls the view after a completion, for two minutes, then rests', () => {
    vi.useFakeTimers();
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
      render(<KycFlow view={view({})} />);
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

  it('stops polling once the record has moved past the submission', () => {
    vi.useFakeTimers();
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
      const { rerender } = render(<KycFlow view={view({})} />);
      pressContinue();
      act(() => lastMount().onComplete());
      router.refresh.mockClear();

      rerender(<KycFlow view={view({ status: 'pending_review', canResume: false, inquiryId: null })} />);
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(router.refresh).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets the session on completion', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
    render(<KycFlow view={view({})} />);
    pressContinue();
    await screen.findByTestId('persona-frame');

    act(() => lastMount().onComplete());

    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
  });

  it('always resumes an expired inquiry through the server, whatever the tab stored', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'tok_stored');
    serverSession('tok_fresh');
    render(<KycFlow view={view({ status: 'expired' })} />);

    pressContinue();

    await screen.findByTestId('persona-frame');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastMount()).toMatchObject({ sessionToken: 'tok_fresh' });
  });
});

describe('KycFlow says each thing once', () => {
  const notStarted = () => view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null });

  it('renders a start as one card: the title, the checklist and the button, no status card', () => {
    render(<KycFlow view={notStarted()} />);

    expect(screen.getByRole('heading', { name: 'Verify your identity' })).toBeTruthy();
    expect(screen.getByRole('list', { name: "What you'll need" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify identity' })).toBeTruthy();
    // The header has the why and the checklist has the what; the card repeats neither.
    expect(screen.queryByText(/government ID and a camera/)).toBeNull();
    expect(screen.getAllByText(/minutes/)).toHaveLength(1);
    expect(screen.getAllByRole('heading')).toHaveLength(2);
  });

  it('renders a resume as the same card under the resume title', () => {
    render(<KycFlow view={view({})} />);

    expect(screen.getByRole('heading', { name: 'Continue your verification' })).toBeTruthy();
    expect(screen.getByRole('list', { name: "What you'll need" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue verification' })).toBeTruthy();
    expect(screen.getAllByRole('heading')).toHaveLength(2);
  });

  it('renders a state with nothing to do as the status card alone', () => {
    render(<KycFlow view={view({ status: 'submitted', canStart: false, canResume: false, inquiryId: null })} />);

    expect(screen.getByRole('heading', { name: 'Verification processing' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: "What you'll need" })).toBeNull();
    expect(screen.queryByRole('button', { name: /verif/i })).toBeNull();
  });
});

describe('KycFlow start answers another click cannot change yet', () => {
  const answer = (status: number, body: object, retryAfter: string | null = null) =>
    fetchMock.mockResolvedValueOnce({ status, headers: { get: () => retryAfter }, json: async () => body });
  const pressStart = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    });
  };
  const startButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Verify identity' });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rests the button, without a Retry, while Persona is unavailable', async () => {
    answer(503, { error: 'Identity verification is temporarily unavailable', code: 'persona_unavailable' });
    render(<KycFlow view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })} />);

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
    render(<KycFlow view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })} />);

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

  it('sends a start that finds the session gone to sign-in, with the way back here', async () => {
    answer(401, { error: 'Unauthorized' });
    render(<KycFlow view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })} />);

    await pressStart();

    expect(router.push).toHaveBeenCalledWith('/sign-in?next=%2Fverification');
  });

  it("shows the page's own words for a server fault, never the server's", async () => {
    answer(500, { error: 'Error starting identity verification' });
    render(<KycFlow view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })} />);

    await pressStart();

    expect(screen.getByRole('alert').textContent).toBe('Could not start verification. Please try again.');
  });

  it('drops the refusal callout once the refreshed card names the state', async () => {
    answer(409, { error: 'Identity verification cannot be started', code: 'already_verified' });
    const { rerender } = render(
      <KycFlow view={view({ status: 'not_started', canStart: true, canResume: false, inquiryId: null })} />
    );

    await pressStart();
    expect(screen.getByText(/already verified/)).toBeTruthy();

    rerender(<KycFlow view={view({ status: 'approved', canStart: false, canResume: false, inquiryId: null })} />);
    expect(screen.queryByText(/already verified/)).toBeNull();
    expect(screen.getByText('Your identity is verified.')).toBeTruthy();
  });
});
