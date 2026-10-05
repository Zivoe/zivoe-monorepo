import Page from '@/components/page';

import { ZIVOE_VAULTS } from '@/zivoe-vaults';

import { type HomepageNav } from './homepage-nav';
import NavHeader from './nav-header';
import ZivoeVaultCard from './zivoe-vault-card';

/**
 * The homepage body, shared by the page and its `loading.tsx`: everything but
 * the NAV figures is static, so the loading state is this same view with the
 * figures pulsing.
 */
export default function HomeView({ nav }: { nav: HomepageNav | 'loading' }) {
  return (
    <div className="bg-surface-base">
      <NavHeader nav={nav === 'loading' ? nav : nav.headlineNav} />

      <Page className="gap-6 lg:gap-8">
        <h1 className="font-heading! text-h5 text-primary lg:text-h4">Vaults</h1>

        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
          {ZIVOE_VAULTS.map((zivoeVault) => (
            <ZivoeVaultCard
              key={zivoeVault.slug}
              zivoeVault={zivoeVault}
              nav={nav === 'loading' ? nav : (nav.cardNavs[zivoeVault.shareClass.key] ?? null)}
            />
          ))}
        </div>
      </Page>
    </div>
  );
}
