import { type ReactNode } from 'react';

import { SplitCta } from '@zivoe/ui/core/split-cta';
import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from '@/components/container';

import { AutocompoundingIcon, EthereumIcon, LiquidityIcon, TargetIcon } from './assets';

export default function Diversify() {
  return (
    <Container className="w-fit justify-between gap-20 pt-16 pb-10 sm:px-10 sm:py-20 md:w-140 md:px-0 xl:w-auto xl:flex-row xl:items-start xl:px-26 xl:pt-50 xl:pb-30 2xl:px-48">
      <div className="flex flex-col gap-6 sm:gap-8 xl:sticky xl:top-16 xl:mt-16 xl:max-w-122">

        <div className="flex flex-col gap-4">
          <h2 className="text-h6 text-primary sm:text-h4 xl:text-h2">One Platform</h2>

          <p className="text-leading text-secondary">
            Access strategy information, reporting, liquidity terms, and network details through one consistent platform experience.
          </p>
        </div>

        <SplitCta href="https://app.zivoe.com" target="_blank">
          Launch App
        </SplitCta>
      </div>

      <div className="flex w-full flex-col gap-6 sm:gap-8 xl:w-auto">
        <Card
          title="One Platform. Multiple Strategies."
          label="Access curated yield opportunities through one unified platform."
          labelClassName="sm:w-1/2"
        >
          <TargetIcon className="pt-5 sm:absolute sm:bottom-0 sm:right-16 sm:pt-0" />
        </Card>

        <Card
          title="Clear Liquidity Terms"
          label="Redemption timing and liquidity terms are defined for each strategy."
          labelClassName="sm:w-1/2"
        >
          <LiquidityIcon className="w-28.75 sm:absolute sm:bottom-0 sm:right-16 sm:w-auto" />
        </Card>


        <Card
          title="Network Roadmap"
          label="Available on Ethereum, with additional networks planned."
          labelClassName="sm:w-1/2"
        >
          <EthereumIcon className="w-28.75 sm:absolute sm:bottom-18 sm:right-16 sm:w-auto" />
        </Card>
      </div>
    </Container>
  );
}

function Card({
  label,
  title,
  labelClassName,
  children
}: {
  label: string;
  title: string;
  labelClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="h-70 w-full overflow-clip rounded-xl bg-element-neutral p-5 sm:relative sm:p-8 xl:h-80 xl:w-130 xl:max-w-full">
      <div className="flex flex-col gap-1 xl:gap-2">
        <p className="font-heading! text-smallSubheading text-primary xl:text-subheading">{title}</p>
        <p className={cn('text-regular text-secondary xl:text-leading', labelClassName)}>{label}</p>
      </div>

      <div className="flex justify-center">{children}</div>
    </div>
  );
}
