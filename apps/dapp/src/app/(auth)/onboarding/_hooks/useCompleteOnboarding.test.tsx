// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LIGHTHOUSE_URL } from '@/lib/lighthouse';
import { type OnboardingFormData } from '@/lib/schemas/onboarding';

import { useCompleteOnboarding } from './useCompleteOnboarding';

const mocks = vi.hoisted(() => ({ push: vi.fn(), completeOnboarding: vi.fn() }));

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
});

describe('useCompleteOnboarding', () => {
  it('sends the user on to the terms, keeping the page Lighthouse sent them from', async () => {
    const { result } = renderHook(() => useCompleteOnboarding({ next: PAGE }), { wrapper });

    act(() => result.current.mutate(FORM));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/terms?next=${encodeURIComponent(PAGE)}`));
  });

  it('stays on the form when onboarding fails', async () => {
    mocks.completeOnboarding.mockResolvedValue({ error: 'Unauthorized' });
    const { result } = renderHook(() => useCompleteOnboarding({ next: PAGE }), { wrapper });

    act(() => result.current.mutate(FORM));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
