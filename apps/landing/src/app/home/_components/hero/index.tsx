import { Suspense } from 'react';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';
import { Link, LinkProps } from '@zivoe/ui/core/link';
import { ChevronRightIcon } from '@zivoe/ui/icons';

import { web3 } from '@/server/web3';

import { formatBigIntToReadable } from '@/lib/utils';

import Container from '@/components/container';

import Navigation from '../../../_components/navigation';
import { HeroClouds } from './clouds';
import { HeroElement1 } from './element-01';
import { HeroElement2 } from './element-02';
import { HeroElement2Mobile } from './element-02-mobile';
import { HeroElement2Tablet } from './elemet-02-tablet';

export default function Hero() {
  return (
    <div className="relative z-0 h-[55rem] overflow-clip bg-element-tertiary sm:h-[75rem] lg:h-[61.25rem]">
      <Container className="z-10 flex-row items-center justify-between pt-4 lg:pl-[6.25rem] lg:pr-8 lg:pt-8">
        <ZivoeLogo />

        <Navigation />
      </Container>

      <Container className="mt-[3.125rem] sm:px-10 md:px-[6.25rem] lg:my-[7.5rem]">
        <div className="flex max-w-[21.45rem] flex-col gap-10 sm:max-w-[33rem] sm:gap-16 lg:max-w-[41.25rem] lg:gap-[12.5rem]">
          <div>
            {/* <NextLink
              href="/"
              className="flex h-7 w-fit items-center gap-1 rounded-full bg-tertiary-500 px-3 text-extraSmall text-primary hover:bg-tertiary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-[1px] focus-visible:ring-offset-neutral-0 sm:h-9 sm:text-leading"
            >
              Zivoe Announces Series A Funding Round
              <ChevronRightIcon className="size-4" />
            </NextLink> */}

            <div className="mt-6 flex flex-col gap-4 lg:mt-8">
              <p className="text-h4 text-primary sm:text-h2 lg:text-h1">Start Investing In Consumer Credit</p>
              <p className="text-smallSubheading text-primary sm:max-w-full">
                Gain exposure to a professionally managed portfolio, backed by thousands of consumer loans, seeking
                14-17% annual returns.{' '}
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

      <div className="absolute -right-[12%] -top-[18%] -z-20 hidden h-full w-full grid-cols-2 items-end gap-4 lg:grid xl:-right-[10%] 2xl:-right-[8%]">
        <div></div>
        <div className="flex w-full justify-end">
          <HeroElement1 className="-z-20" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 -z-10 hidden h-full w-full grid-cols-3 items-end gap-4 lg:grid">
        <div></div>
        <div className="col-span-2 flex w-full justify-end">
          <HeroElement2 className="mt-[20px] xl:mt-[0px]" />
        </div>
      </div>

      <HeroElement2Tablet className="absolute bottom-0 right-0 -z-10 hidden w-[95%] sm:block lg:hidden" />
      <HeroElement2Mobile className="absolute bottom-0 right-0 -z-10 sm:hidden" />

      <HeroClouds className="absolute -left-[150px] bottom-1/4 -z-20 w-[433px] rotate-[15deg] sm:bottom-1/3 lg:-bottom-[100px] lg:w-[866px]" />
    </div>
  );
}

function HeroButton(props: LinkProps) {
  return (
    <Link href="https://app.zivoe.com" target="_blank" variant="primary" {...props}>
      Legacy App
    </Link>
  );
}

async function Statistics() {
  const [tvl, apy, revenue] = await Promise.all([web3.getTVL(), web3.getAPY(), web3.getRevenue()]);

  return (
    <div className="flex gap-6 lg:gap-16">
      <Statistic label="TVL" value={'$' + formatBigIntToReadable(tvl)} />

      {apy && (
        <Statistic
          label="APY"
          value={`${apy.toFixed(2)}%`}
          description="This is the approximate yield of Zivoe's new zveUSD product, which will be launching in May. Upon launch the real time yield of zveUSD will be displayed here."
        />
      )}

      <Statistic label="Revenue" value={'$' + formatBigIntToReadable(revenue, 6)} />
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
