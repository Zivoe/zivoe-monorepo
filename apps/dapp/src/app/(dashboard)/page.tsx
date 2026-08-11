import Page from '@/components/page';

import { ZIVOE_VAULTS } from '@/zivoe-vaults';

import { OnboardingGuard } from './_components/onboarding-guard';
import { getHomepageNav } from './_zivoe-vaults/homepage-nav';
import NavHeader from './_zivoe-vaults/nav-header';
import ZivoeVaultCard from './_zivoe-vaults/zivoe-vault-card';

export default async function HomePage() {
  const { headlineNav, cardNavs } = await getHomepageNav();

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <NavHeader nav={headlineNav} />

        <Page className="gap-6 lg:gap-8">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Vaults</h1>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {ZIVOE_VAULTS.map((zivoeVault) => (
              <ZivoeVaultCard
                key={zivoeVault.slug}
                zivoeVault={zivoeVault}
                nav={cardNavs[zivoeVault.shareClass.key] ?? null}
              />
            ))}
          </div>
        </Page>
      </div>
    </>
  );
}
