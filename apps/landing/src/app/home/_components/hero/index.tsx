import { getShareClassIdentity, listLiveChains } from '@zivoe/centrifuge-indexer';

import { centrifuge } from '@/server/centrifuge';

import Container from '@/components/container';
import {
  HeroElement2MobileComponent,
  HeroElement2TabletComponent,
  HeroElemet1Component,
  HeroElemet2Component
} from '@/components/hero';
import { LighthouseCta } from '@/components/lighthouse-cta';
import NavigationSection from '@/components/navigation';
import { VaultsCta } from '@/components/vaults-cta';

import { env } from '@/env';

import { HeroClouds } from './clouds';
import { Statistics } from './statistics';

// The share class whose live figures the hero shows: the landing's one Zivoe Vault.
const SHARE_CLASS_KEY = 'zsmb';

export default async function Hero() {
  const environment = env.NEXT_PUBLIC_CHAIN_ENV;
  const metrics = await centrifuge.getCurrentShareMetrics(SHARE_CLASS_KEY);
  const chains = listLiveChains({ environment, key: SHARE_CLASS_KEY });
  const { poolId } = getShareClassIdentity({ environment, key: SHARE_CLASS_KEY });
  // CentrifugeScan only indexes mainnet pools.
  const centrifugeScanUrl = environment === 'mainnet' ? `https://centrifugescan.io/pools/${poolId}` : undefined;

  return (
    <div className="relative z-0 min-h-280 overflow-clip bg-element-tertiary sm:min-h-315 lg:min-h-255">
      <NavigationSection />

      {/* Below lg the artwork is bottom-anchored and scales with the viewport; the padding reserves its height. */}
      <Container className="mt-12.5 pb-90 sm:px-10 sm:pb-[min(calc(75vw+5rem),44rem)] md:px-25 lg:my-30 lg:pb-0">
        <div className="flex w-full max-w-[21.45rem] flex-col gap-8 sm:max-w-150 sm:gap-10 lg:max-w-165">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <p className="text-tiny font-medium tracking-[0.2em] text-brand-subtle uppercase sm:text-extraSmall">
                Private credit. On-chain. Transparent.
              </p>
              <h1 className="text-h4 text-primary sm:text-h2">The private credit layer for stablecoins</h1>
              <p className="max-w-120 text-smallSubheading text-primary">
                Access institutional yield across curated real-world credit strategies.
              </p>
            </div>
            <Statistics metrics={metrics} chains={chains} centrifugeScanUrl={centrifugeScanUrl} />
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <LighthouseCta />
              <VaultsCta />
            </div>
          </div>
        </div>
      </Container>

      <HeroElemet1Component />
      <HeroElemet2Component />
      <HeroElement2TabletComponent />
      <HeroElement2MobileComponent />

      <HeroClouds
        aria-hidden="true"
        className="absolute bottom-1/4 -left-37.5 -z-20 w-108.25 rotate-15 sm:bottom-1/3 lg:-bottom-25 lg:w-216.5"
      />
    </div>
  );
}
