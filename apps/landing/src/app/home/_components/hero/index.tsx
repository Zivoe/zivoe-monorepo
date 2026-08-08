import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';
import { SplitCta, type SplitCtaProps } from '@zivoe/ui/core/split-cta';

import Container from '@/components/container';
import {
  HeroElement2MobileComponent,
  HeroElement2TabletComponent,
  HeroElemet1Component,
  HeroElemet2Component
} from '@/components/hero';
import NavigationSection from '@/components/navigation';

import { CentrifugeIcon } from '../experience/assets';
import { HeroClouds } from './clouds';

const STATISTIC_DISCLOSURE =
  'Historical platform metrics, rounded for presentation purposes. Past performance is not indicative of future results. For informational purposes only; this is not an offer to sell or a solicitation of an offer to buy any security or financial product.';

export default function Hero() {
  return (
    <div className="relative z-0 h-220 overflow-clip bg-element-tertiary sm:h-300 lg:h-245">
      <NavigationSection />

      <Container className="mt-12.5 sm:px-10 md:px-25 lg:my-30">
        <div className="flex max-w-[21.45rem] flex-col gap-10 sm:max-w-132 sm:gap-16 lg:max-w-165 lg:gap-50">
          <div>
            <div className="mt-6 flex flex-col gap-4 lg:mt-8">
              <div className="flex items-center gap-2">
                <span className="text-small text-secondary">Powered by</span>
                <CentrifugeIcon aria-label="Centrifuge" role="img" className="h-6 w-auto sm:h-7" />
              </div>

              <h1 className="text-h4 text-primary sm:text-h2">The private credit layer for stablecoins</h1>
              <p className="max-w-120 text-smallSubheading text-primary">
                Access institutional grade yield opportunities across private credit markets.
              </p>
            </div>

            <div className="mt-4 sm:mt-6">
              <HeroButton size="m" className="sm:hidden" />
              <HeroButton size="l" className="hidden sm:flex" />
            </div>
          </div>

          <Statistics />
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

function HeroButton(props: Omit<SplitCtaProps, 'children'>) {
  return (
    <SplitCta href="https://app.zivoe.com" target="_blank" {...props}>
      View Vaults
    </SplitCta>
  );
}

// TODO: these are hardcoded operating figures. Restore the live reads (`centrifuge.getShareClassNavs`,
// summed with `sumShareClassNavs` so NAV covers every live share class) once the transparency data is
// available post-migration, and re-wrap this in <Suspense> when it does.
function Statistics() {
  return (
    <div className="flex gap-2 sm:gap-6 lg:-mt-20 lg:gap-16">
      <Statistic label="Loans Funded" value="1,000+" />

      <Statistic label="Originations" value="$10M" />

      <Statistic label="Collections" value="$1.5M" />
    </div>
  );
}

function Statistic({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-3 text-primary">
      <div className="flex items-center">
        <p className="text-small whitespace-nowrap text-primary/80 sm:text-leading lg:text-smallSubheading">{label}</p>

        <ContextualHelp
          variant="info"
          aria-label={`About ${label}`}
          className="w-72 max-w-[calc(100vw-2rem)]"
          triggerClassName="text-primary/80"
        >
          <ContextualHelpDescription>{STATISTIC_DISCLOSURE}</ContextualHelpDescription>
        </ContextualHelp>
      </div>

      <p className="text-h6 whitespace-nowrap sm:text-h3 md:text-h2 lg:text-h1">{value}</p>
    </div>
  );
}
