import { Suspense } from 'react';

import { getUserMenuData } from '@/server/data/auth';

import { ZSMB_ZIVOE_VAULT, resolveZivoeVaultIdentities } from '@/zivoe-vaults';

import { OnboardingGuard } from '../_components/onboarding-guard';
import Portfolio from './portfolio';

export const metadata = { title: 'Portfolio | Zivoe' };

export default function PortfolioPage() {
  return (
    <>
      <OnboardingGuard />
      <Portfolio
        identities={resolveZivoeVaultIdentities(ZSMB_ZIVOE_VAULT)}
        userInfo={
          <Suspense fallback={null}>
            <PortfolioUserInfo />
          </Suspense>
        }
      />
    </>
  );
}

async function PortfolioUserInfo() {
  const { name, email } = await getUserMenuData();

  return (
    <div className="ml-auto hidden min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right text-small text-base lg:flex">
      <span className="font-medium break-words">{name}</span>
      <span aria-hidden="true" className="opacity-50">
        |
      </span>
      <span className="break-all opacity-80">{email}</span>
    </div>
  );
}
