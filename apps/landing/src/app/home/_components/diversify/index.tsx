import { ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';

import Container from '@/components/container';

import { AutocompoundingIcon, LiquidityIcon, TargetIcon } from './assets';

export default function Diversify() {
  return (
    <Container className="items-center justify-between pb-[7.5rem] pt-[12.5rem] lg:px-[6.25rem] xl:flex-row xl:items-start 2xl:px-[12rem]">
      <div className="mt-16 flex flex-col gap-8">
        <p className="font-heading text-leading text-primary">Diversify Your Portfolio</p>

        <div className="flex flex-col gap-4">
          <p className="max-w-[30rem] text-h2 text-primary">Tap into an Institutional-Grade Asset Class</p>

          <p className="max-w-[28rem] text-leading text-secondary">
            Zivoe gives you access to the consumer credit market, a proven asset class that has delivered strong returns
            to Wall Street investors for over 50 years.
          </p>
        </div>

        <Link href="/" variant="primary">
          Start earning
        </Link>
      </div>

      <div className="flex flex-col gap-16">
        <Card label="Target APY" title="14.00% - 17.00%">
          <TargetIcon className="absolute bottom-0 right-16" />
        </Card>

        <Card label="For maximum growth" title="Autocompounding">
          <AutocompoundingIcon className="absolute bottom-0 right-8" />
        </Card>

        <Card label="Via Secondary Markets" title="24/7 Liquidity">
          <LiquidityIcon className="absolute bottom-0 right-16" />
        </Card>
      </div>
    </Container>
  );
}

function Card({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="relative h-[16.5rem] w-[21.25rem] rounded-xl bg-element-neutral p-8 xl:h-80 xl:w-[32.5rem]">
      <div className="flex flex-col gap-2">
        <p className="text-leading text-secondary">{label}</p>
        <p className="font-heading text-subheading text-primary">{title}</p>
      </div>

      {children}
    </div>
  );
}
