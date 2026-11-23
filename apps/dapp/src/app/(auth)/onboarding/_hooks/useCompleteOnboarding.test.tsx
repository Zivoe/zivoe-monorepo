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
const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';
const PROFILE: OnboardingFormData = {
  firstName: 'Zivoe',
  lastName: 'Agent',
  countryOfResidence: 'US',
  amountOfInterest: '10k_100k',
  howFoundZivoe: 'other'
};
const ORGANIZATION = { name: 'Acme Capital LLC', countryOfIncorporation: 'US', title: 'Partner' };

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('location', { ...window.location, assign: mocks.assign });
  mocks.completeOnboarding.mockResolvedValue({ success: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('useCompleteOnboarding', () => {
  it('lands on the dashboard once the profile is saved', async () => {
    const { result } = renderHook(() => useCompleteOnboarding({}), { wrapper });

    act(() => result.current.mutate({ profile: PROFILE }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/'));
    expect(mocks.completeOnboarding).toHaveBeenCalledWith({ profile: PROFILE });
  });

  it('goes back to the Lighthouse page that sent the user, through the pass route', async () => {
    const { result } = renderHook(() => useCompleteOnboarding({ next: PAGE }), { wrapper });

    act(() => result.current.mutate({ profile: PROFILE }));

    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith(`/api/lighthouse/pass?next=${encodeURIComponent(PAGE)}`)
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('hands a new organization on to the invite step instead of leaving', async () => {
    mocks.completeOnboarding.mockResolvedValue({ success: true, organizationId: ORGANIZATION_ID });
    const onOrganizationCreated = vi.fn();
    const { result } = renderHook(() => useCompleteOnboarding({ onOrganizationCreated }), { wrapper });

    act(() => result.current.mutate({ profile: PROFILE, organization: ORGANIZATION }));

    await waitFor(() => expect(onOrganizationCreated).toHaveBeenCalledWith(ORGANIZATION_ID));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('stays on the form when onboarding fails', async () => {
    mocks.completeOnboarding.mockResolvedValue({ error: 'Unauthorized' });
    const { result } = renderHook(() => useCompleteOnboarding({ next: PAGE }), { wrapper });

    act(() => result.current.mutate({ profile: PROFILE }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});
