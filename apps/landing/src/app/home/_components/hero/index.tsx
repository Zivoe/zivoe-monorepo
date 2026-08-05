import { Suspense } from 'react';

import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';
import { Link, type LinkProps } from '@zivoe/ui/core/link';

import { centrifuge } from '@/server/centrifuge';

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
import MigrationNotice from './migration-notice';

/** Published Target APY, in percent, while the trailing-yield read is disabled. */
const TARGET_APY_PERCENT = 14;

export default function Hero() {
  return (
    <div className="relative z-0 h-220 overflow-clip bg-element-tertiary sm:h-300 lg:h-245">
      <NavigationSection />

      <Container className="mt-12.5 sm:px-10 md:px-25 lg:my-30">
        <div className="flex max-w-[21.45rem] flex-col gap-10 sm:max-w-132 sm:gap-16 lg:max-w-165 lg:gap-50">
          <div>
            <div className="mt-6 flex flex-col gap-4 lg:mt-8">
              <h1 className="text-h4 text-primary sm:text-h2">Your Portal to Private Credit</h1>
              <p className="text-smallSubheading text-primary sm:max-w-full">
                Grow your wealth through a diversified, short-duration portfolio designed to generate sustainable yield.
              </p>
            </div>

            <MigrationNotice />

            <div className="mt-4 sm:mt-6">
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

      <HeroClouds
        aria-hidden="true"
        className="absolute bottom-1/4 -left-37.5 -z-20 w-108.25 rotate-15 sm:bottom-1/3 lg:-bottom-25 lg:w-216.5"
      />
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
  const metrics = await centrifuge.getCurrentShareMetrics();

  return (
    <div className="flex gap-6 lg:gap-16">
      {metrics ? <Statistic label="AUM" value={'$' + formatBigIntToReadable(BigInt(metrics.navD18))} /> : null}

      <Statistic label="Target APY" value={`${TARGET_APY_PERCENT}%`} />

      {metrics ? (
        <Statistic label="Token Price" value={`$${customNumber(Number(metrics.sharePriceD18) / 1e18)}`} />
      ) : null}
    </div>
  );
}

function Statistic({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-3 text-primary">
      <div className="flex items-center">
        <p className="text-leading whitespace-nowrap text-primary/80 lg:text-smallSubheading">{label}</p>

        {description && (
          <ContextualHelp variant="info">
            <ContextualHelpDescription>{description}</ContextualHelpDescription>
          </ContextualHelp>
        )}
      </div>
      <p className="text-h6 whitespace-nowrap sm:text-h3 md:text-h2 lg:text-h1">{value}</p>
    </div>
  );
}
