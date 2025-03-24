import NextLink from 'next/link';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Link, LinkProps } from '@zivoe/ui/core/link';
import { ChevronRightIcon } from '@zivoe/ui/icons';

import Container from '@/components/container';

import Navigation from './_components/navigation';

export default function Home() {
  return (
    <>
      <Hero />
    </>
  );
}

function Hero() {
  return (
    <div className="h-[43.125rem] bg-element-tertiary lg:h-[62.75rem]">
      <Container className="max-w-[108rem] flex-row items-center justify-between pt-4 lg:pl-[6.25rem] lg:pr-8 lg:pt-8">
        <ZivoeLogo />
        <Navigation />
      </Container>

      <Container className="mt-[3.125rem] max-w-[108rem] lg:my-[7.5rem] lg:px-[6.25rem]">
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

          <div className="hidden gap-16 lg:flex">
            <HeroStatistic label="TVL" value="$6M" />
            <HeroStatistic label="APY" value="17%" />
            <HeroStatistic label="Revenue" value="$234.82K" />
          </div>
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

function HeroStatistic({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3 text-primary">
      <p className="text-smallSubheading text-primary/80">{label}</p>
      <h1>{value}</h1>
    </div>
  );
}
