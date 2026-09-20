// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LIGHTHOUSE_URL } from '@/lib/lighthouse';
import { type OnboardingFormData } from '@/lib/schemas/onboarding';

import { useCompleteOnboarding } from './useCompleteOnboarding';

const mocks = vi.hoisted(() => ({ push: vi.fn(), assign: vi.fn(), completeOnboarding: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/server/actions/onboarding', () => ({ completeOnboarding: mocks.completeOnboarding }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const PAGE = `${LIGHTHOUSE_URL}/liquidity`;
const FORM: OnboardingFormData = {
  accountType: 'individual',
  firstName: 'Zivoe',
  lastName: 'Agent',
  countryOfResidence: 'US',
  amountOfInterest: '10k_100k',
  howFoundZivoe: 'other'
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completeOnboarding.mockResolvedValue({ success: true });
  // jsdom cannot navigate; the hook only needs `assign` to exist.
  vi.stubGlobal('location', { assign: mocks.assign });
});
afterEach(() => vi.unstubAllGlobals());

describe('useCompleteOnboarding', () => {
  it('returns a user Lighthouse sent to the pass route, with a full navigation, once onboarded', async () => {
    const { result } = renderHook(() => useCompleteOnboarding({ next: PAGE }), { wrapper });

    act(() => result.current.mutate(FORM));

    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith(`/api/lighthouse/pass?next=${encodeURIComponent(PAGE)}`)
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('sends everyone else to the dashboard', async () => {
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    act(() => result.current.mutate(FORM));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/'));
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('stays on the form when onboarding fails', async () => {
    mocks.completeOnboarding.mockResolvedValue({ error: 'Unauthorized' });
    const { result } = renderHook(() => useCompleteOnboarding({ next: PAGE }), { wrapper });

    act(() => result.current.mutate(FORM));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
