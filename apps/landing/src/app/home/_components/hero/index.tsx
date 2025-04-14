import { Suspense } from 'react';

import NextLink from 'next/link';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Link, LinkProps } from '@zivoe/ui/core/link';
import { ChevronRightIcon } from '@zivoe/ui/icons';

import { web3 } from '@/server/web3';

import { formatBigIntToReadable } from '@/lib/utils';

import Container from '@/components/container';

import Navigation from '../../../_components/navigation';
import { HeroClouds } from './clouds';

export default function Hero() {
  return (
    <div className="relative z-0 h-[55rem] bg-element-tertiary sm:h-[75rem] lg:h-[61.25rem]">
      <Container className="z-10 flex-row items-center justify-between pt-4 lg:pl-[6.25rem] lg:pr-8 lg:pt-8">
        <ZivoeLogo />

        <Navigation />
      </Container>

      <Container className="mt-[3.125rem] sm:px-10 md:px-[6.25rem] lg:my-[7.5rem]">
        <div className="flex max-w-[21.45rem] flex-col gap-10 sm:max-w-[33rem] sm:gap-16 lg:max-w-[41.25rem] lg:gap-[12.5rem]">
          <div>
            <NextLink
              href="/"
              className="flex h-7 w-fit items-center gap-1 rounded-full bg-tertiary-500 px-3 text-extraSmall text-primary hover:bg-tertiary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-[1px] focus-visible:ring-offset-neutral-0 sm:h-9 sm:text-leading"
            >
              Zivoe Announces Series A Funding Round
              <ChevronRightIcon className="size-4" />
            </NextLink>

            <div className="mt-6 flex flex-col gap-4 lg:mt-8">
              <p className="text-h4 text-primary sm:text-h2 lg:text-h1">Earn Stable Yields with Your Stablecoins</p>
              <p className="max-w-[14.6875rem] text-smallSubheading text-primary/80 sm:max-w-full">
                Backed by thousands of consumer loans.
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

      <HeroClouds className="absolute -left-[150px] bottom-1/4 -z-10 w-[433px] rotate-[15deg] sm:bottom-1/3 lg:-bottom-[100px] lg:w-[866px]" />
    </div>
  );
}

function HeroButton(props: LinkProps) {
  return (
    <Link href="/" variant="primary" {...props}>
      Start Earning
      <ChevronRightIcon />
    </Link>
  );
}

async function Statistics() {
  const [tvl, apy, revenue] = await Promise.all([web3.getTVL(), web3.getAPY(), web3.getRevenue()]);

  return (
    <div className="flex gap-6 lg:gap-16">
      <Statistic label="TVL" value={'$' + formatBigIntToReadable(tvl)} />

      {apy && <Statistic label="APY" value={`${apy.toFixed(2)}%`} />}

      <Statistic label="Revenue" value={'$' + formatBigIntToReadable(revenue, 6)} />
    </div>
  );
}

function Statistic({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3 text-primary">
      <p className="text-leading text-primary/80 lg:text-smallSubheading">{label}</p>
      <p className="text-h6 sm:text-h3 md:text-h2 lg:text-h1">{value}</p>
    </div>
  );
}
