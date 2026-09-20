import { getShareClassIdentity, listLiveChains } from '@zivoe/centrifuge-indexer';

import Container from '@/components/container';
import {
  HeroElement2MobileComponent,
  HeroElement2TabletComponent,
  HeroElemet1Component,
  HeroElemet2Component
} from '@/components/hero';
import NavigationSection from '@/components/navigation';
import { VaultsCta } from '@/components/vaults-cta';

import { env } from '@/env';

import { HeroClouds } from './clouds';
import { LighthouseCta } from './lighthouse-cta';
import { Statistics } from './statistics';

export default function Hero() {
  const environment = env.NEXT_PUBLIC_CHAIN_ENV;
  const chains = listLiveChains({ environment, key: 'zsmb' });
  const { poolId } = getShareClassIdentity({ environment, key: 'zsmb' });
  return (
    <div className="relative z-0 min-h-280 overflow-clip bg-element-tertiary sm:min-h-315 lg:min-h-255">
      <NavigationSection />

      <Container className="mt-12.5 pb-90 sm:px-10 sm:pb-[calc(75vw+5rem)] md:px-25 lg:my-30 lg:pb-0">
        <div className="flex w-full max-w-[21.45rem] flex-col gap-8 sm:max-w-150 sm:gap-10 lg:max-w-165">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <p className="text-[0.6875rem] leading-5 font-medium tracking-[0.2em] text-tertiary uppercase sm:text-[0.8125rem]">
                Private credit. On-chain. Transparent.
              </p>
              <h1 className="text-h4 text-primary sm:text-h2">The private credit layer for stablecoins</h1>
              <p className="max-w-120 text-smallSubheading text-primary">
                Access institutional yield across curated real-world credit strategies.
              </p>
            </div>
            <Statistics chains={chains} centrifugeUrl={`https://centrifugescan.io/pools/${poolId}`} />
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
