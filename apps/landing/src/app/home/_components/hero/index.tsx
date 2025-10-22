import { Suspense } from 'react';

import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';
import { Link, LinkProps } from '@zivoe/ui/core/link';

import { web3 } from '@/server/web3';

import { customNumber, formatBigIntToReadable } from '@/lib/utils';

import Container from '@/components/container';
import {
  HeroElement2MobileComponent,
  HeroElement2TabletComponent,
  HeroElemet1Component,
  HeroElemet2Component
} from '@/components/hero';
import NavigationSection from '@/components/navigation';

import { HeroClouds } from './clouds';

export default function Hero() {
  return (
    <div className="relative z-0 h-[55rem] overflow-clip bg-element-tertiary sm:h-[75rem] lg:h-[61.25rem]">
      <NavigationSection />

      <Container className="mt-[3.125rem] sm:px-10 md:px-[6.25rem] lg:my-[7.5rem]">
        <div className="flex max-w-[21.45rem] flex-col gap-10 sm:max-w-[33rem] sm:gap-16 lg:max-w-[41.25rem] lg:gap-[12.5rem]">
          <div>
            <div className="mt-6 flex flex-col gap-4 lg:mt-8">
              <p className="text-h4 text-primary sm:text-h2">Your Portal to Private Credit</p>
              <p className="text-smallSubheading text-primary sm:max-w-full">
                Grow your wealth through a diversified, short-duration portfolio 
                designed to generate sustainable yield.
              </p>
            </div>

            <div className="mt-4 sm:mt-10">
              <HeroButton size="m" className="sm:hidden" />
              <HeroButton size="l" className="hidden sm:flex" />
            </div>
          </div>

          <Suspense>
            <Statistics />
          </Suspense>
        </div>
      </Container>

      <HeroElemet1Component />
      <HeroElemet2Component />
      <HeroElement2TabletComponent />
      <HeroElement2MobileComponent />

      <HeroClouds className="absolute -left-[150px] bottom-1/4 -z-20 w-[433px] rotate-[15deg] sm:bottom-1/3 lg:-bottom-[100px] lg:w-[866px]" />
    </div>
  );
}

function HeroButton(props: LinkProps) {
  return (
    <Link href="https://app.zivoe.com" target="_blank" hideExternalLinkIcon variant="primary" {...props}>
      Start Earning
    </Link>
  );
}

async function Statistics() {
  const [currentDailyData, revenue] = await Promise.all([web3.getCurrentDailyData(), web3.getRevenue()]);

  return (
    <div className="flex gap-6 lg:gap-16">
      {currentDailyData?.tvl ? (
        <Statistic label="TVL" value={'$' + formatBigIntToReadable(BigInt(currentDailyData.tvl.total))} />
      ) : null}

      {currentDailyData?.apy ? <Statistic label="APY" value={customNumber(currentDailyData.apy) + '%'} /> : null}

      {revenue ? <Statistic label="Revenue" value={'$' + formatBigIntToReadable(BigInt(revenue), 6)} /> : null}
    </div>
  );
}

function Statistic({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="flex flex-col gap-3 text-primary">
      <div className="flex items-center">
        <p className="text-leading text-primary/80 lg:text-smallSubheading">{label}</p>

        {description && (
          <ContextualHelp variant="info">
            <ContextualHelpDescription>{description}</ContextualHelpDescription>
          </ContextualHelp>
        )}
      </div>
      <p className="text-h6 sm:text-h3 md:text-h2 lg:text-h1">{value}</p>
    </div>
  );
}
