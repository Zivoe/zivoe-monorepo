import { ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';

import Container from '@/components/container';

import { AutocompoundingIcon, EthereumIcon, LiquidityIcon, TargetIcon } from './assets';

export default function Diversify() {
  return (
    <Container className="w-fit justify-between gap-20 pb-10 pt-16 sm:px-10 sm:py-20 md:w-[35rem] md:px-0 xl:w-auto xl:flex-row xl:items-start xl:px-[6.5rem] xl:pb-[7.5rem] xl:pt-[12.5rem] 2xl:px-[12rem]">
      <div className="flex flex-col gap-6 sm:gap-8 xl:sticky xl:top-16 xl:mt-16 xl:max-w-[30.5rem]">
        <p className="!font-heading text-small text-primary sm:text-leading">Diversify Your Portfolio</p>

        <div className="flex flex-col gap-4">
          <p className="text-h6 text-primary sm:text-h4 xl:text-h2">Tap into an Institutional-Grade Asset Class</p>

          <p className="text-leading text-secondary">
            Zivoe gives you access to the private credit market, a proven asset class that has delivered strong returns
            to Wall Street for over 50 years.
          </p>
        </div>

        <Link href="https://app.zivoe.com" target="_blank" hideExternalLinkIcon variant="primary">
          Start Earning
        </Link>
      </div>

      <div className="flex w-full flex-col gap-6 sm:gap-8 xl:w-auto">
        <Card label="Backed by Private Credit" title="Earn Real Yield">
          <TargetIcon className="pt-5 sm:absolute sm:bottom-0 sm:right-16 sm:pt-0" />
        </Card>

        <Card label="For maximum growth" title="Autocompounding">
          <AutocompoundingIcon className="-ml-10 w-[99%] sm:absolute sm:bottom-0 sm:right-8 sm:-ml-0 sm:w-auto" />
        </Card>

        <Card label="Via Instant Redemptions" title="24/7 Liquidity">
          <LiquidityIcon className="w-[7.1875rem] sm:absolute sm:bottom-0 sm:right-16 sm:w-auto" />
        </Card>

        <Card label="On Ethereum" title="Live now">
          <EthereumIcon className="w-[7.1875rem] sm:absolute sm:bottom-[4.5rem] sm:right-16 sm:w-auto" />
        </Card>
      </div>
    </Container>
  );
}

function Card({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="h-[17.5rem] w-full overflow-clip rounded-xl bg-element-neutral p-5 sm:relative sm:p-8 xl:h-80 xl:w-[32.5rem] xl:max-w-full">
      <div className="flex flex-col gap-1 xl:gap-2">
        <p className="!font-heading text-smallSubheading text-primary xl:text-subheading">{title}</p>
        <p className="text-regular text-secondary xl:text-leading">{label}</p>
      </div>

      <div className="flex justify-center">{children}</div>
    </div>
  );
}
