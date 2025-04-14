import { ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';

import Container from '@/components/container';

import { AutocompoundingIcon, EthereumIcon, LiquidityIcon, TargetIcon } from './assets';

export default function Diversify() {
  return (
    <Container className="w-fit items-center justify-between gap-16 pb-16 pt-10 xl:w-auto xl:flex-row xl:items-start xl:gap-0 xl:px-[6.25rem] xl:pb-[7.5rem] xl:pt-[12.5rem] 2xl:px-[12rem]">
      <div className="flex flex-col gap-8 xl:mt-16">
        <p className="font-heading text-small text-primary xl:text-leading">Diversify Your Portfolio</p>

        <div className="flex flex-col gap-4">
          <p className="max-w-[21.45rem] text-h5 text-primary xl:max-w-[30rem] xl:text-h2">
            Tap into an Institutional-Grade Asset Class
          </p>

          <p className="max-w-[21.45rem] text-leading text-secondary xl:max-w-[28rem]">
            Zivoe gives you access to the consumer credit market, a proven asset class that has delivered strong returns
            to Wall Street investors for over 50 years.
          </p>
        </div>

        <Link href="/" variant="primary">
          Start Earning
        </Link>
      </div>

      <div className="flex w-full flex-col gap-6 xl:w-auto xl:gap-16">
        <Card label="Target APY" title="14.00% - 17.00%">
          <TargetIcon className="pt-5 xl:absolute xl:bottom-0 xl:right-16 xl:pt-0" />
        </Card>

        <Card label="For maximum growth" title="Autocompounding">
          <AutocompoundingIcon className="-ml-10 xl:absolute xl:bottom-0 xl:right-8 xl:-ml-0" />
        </Card>

        <Card label="Via Secondary Markets" title="24/7 Liquidity">
          <LiquidityIcon className="w-[7.1875rem] xl:absolute xl:bottom-0 xl:right-16 xl:w-auto" />
        </Card>

        <Card label="Live now" title="On Ethereum">
          <EthereumIcon className="w-[7.1875rem] xl:absolute xl:bottom-[4.5rem] xl:right-16 xl:w-auto" />
        </Card>
      </div>
    </Container>
  );
}

function Card({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="h-[17.5rem] max-w-[21.5rem] overflow-clip rounded-xl bg-element-neutral p-5 xl:relative xl:h-80 xl:w-[32.5rem] xl:max-w-full xl:p-8">
      <div className="flex flex-col gap-1 xl:gap-2">
        <p className="font-heading text-smallSubheading text-primary xl:text-subheading">{title}</p>
        <p className="text-regular text-secondary xl:text-leading">{label}</p>
      </div>

      <div className="flex justify-center">{children}</div>
    </div>
  );
}
