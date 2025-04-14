import { Suspense } from 'react';

import NextLink from 'next/link';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Link, LinkProps } from '@zivoe/ui/core/link';
import { ChevronRightIcon } from '@zivoe/ui/icons';

import { web3 } from '@/server/web3';

import { formatBigIntToReadable } from '@/lib/utils';

import Container from '@/components/container';

import Navigation from '../../_components/navigation';

export default function Hero() {
  return (
    <div className="h-[43.125rem] bg-element-tertiary lg:h-[62.75rem]">
      <Container className="flex-row items-center justify-between pt-4 lg:pl-[6.25rem] lg:pr-8 lg:pt-8">
        <ZivoeLogo />

        <Navigation />
      </Container>

      <Container className="mt-[3.125rem] lg:my-[7.5rem] lg:px-[6.25rem]">
        <div className="flex max-w-[25rem] flex-col gap-[12.5rem] lg:max-w-[41.25rem]">
          <div>
            <NextLink
              href="/"
              className="flex h-7 w-fit items-center gap-1 rounded-full bg-tertiary-500 px-3 text-extraSmall text-primary lg:h-9 lg:text-leading"
            >
              Zivoe Announces Series A Funding Round
              <ChevronRightIcon className="size-4" />
            </NextLink>

            <div className="mt-5 flex flex-col gap-4 lg:mt-8">
              <p className="text-h4 text-primary lg:text-h1">
                Earn Stable <br className="sm:hidden" />
                Yields with <br className="sm:hidden" /> Your Stablecoins
              </p>

              <p className="text-smallSubheading text-primary/80">
                Backed by thousands of <br className="sm:hidden" /> consumer loans.
              </p>
            </div>

            <div className="mt-4 lg:mt-10">
              <HeroButton size="m" className="lg:hidden" />
              <HeroButton size="l" className="hidden lg:flex" />
            </div>
          </div>

          <Suspense>
            <Statistics />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}

function HeroButton(props: LinkProps) {
  return (
    <Link href="/" variant="primary" {...props}>
      Start earning
      <ChevronRightIcon />
    </Link>
  );
}

async function Statistics() {
  const [tvl, apy] = await Promise.all([web3.getTVL(), web3.getAPY()]);

  return (
    <div className="hidden gap-16 lg:flex">
      <Statistic label="TVL" value={'$' + formatBigIntToReadable(tvl)} />

      {apy && <Statistic label="APY" value={`${apy.toFixed(2)}%`} />}

      <Statistic label="Revenue" value="$234.82K" />
    </div>
  );
}

function Statistic({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3 text-primary">
      <p className="text-smallSubheading text-primary/80">{label}</p>
      <h1>{value}</h1>
    </div>
  );
}
