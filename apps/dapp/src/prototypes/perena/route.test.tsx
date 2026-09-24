import { beforeEach, expect, it, vi } from 'vitest';

import PerenaDemoRoute from '@/app/(dashboard)/vaults/perena-usdc-demo/page';

const mocks = vi.hoisted(() => ({
  enabled: false,
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('./enabled', () => ({ isPerenaDemoEnabled: () => mocks.enabled }));
vi.mock('./demo-page', () => ({ PerenaDemoPage: () => null }));
vi.mock('@/app/(dashboard)/_components/onboarding-guard', () => ({ OnboardingGuard: () => null }));

beforeEach(() => {
  mocks.enabled = false;
  vi.clearAllMocks();
});

it('returns notFound for a disabled environment before reading search params', async () => {
  await expect(PerenaDemoRoute({ searchParams: Promise.resolve({ view: 'redeem' }) })).rejects.toThrow(
    'NEXT_NOT_FOUND'
  );
  expect(mocks.notFound).toHaveBeenCalledOnce();
});

it('renders the enabled route with the existing onboarding guard', async () => {
  mocks.enabled = true;
  const page = await PerenaDemoRoute({ searchParams: Promise.resolve({ view: 'redeem' }) });
  expect(page.props.children).toHaveLength(2);
  expect(page.props.children[1].props.initialTab).toBe('redeem');
  expect(mocks.notFound).not.toHaveBeenCalled();
});
