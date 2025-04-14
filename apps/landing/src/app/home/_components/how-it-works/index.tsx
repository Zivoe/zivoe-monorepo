import { ReactNode } from 'react';
import React from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from '@/components/container';

import { Step1Icon, Step2Icon, Step3Icon } from './assets';

export default function HowItWorks() {
  return (
    <Container className="w-fit justify-between gap-10 py-10 lg:w-auto lg:items-center lg:gap-20 lg:px-[6rem] lg:py-[10rem] xl:px-[8.75rem]">
      <div className="flex flex-col gap-10 lg:items-center lg:gap-20">
        <div className="flex flex-col gap-8 lg:items-center">
          <p className="text-small text-primary lg:text-leading">How It Works</p>

          <div className="flex flex-col gap-4 lg:items-center">
            <p className="max-w-[18.5rem] text-h6 text-primary lg:max-w-none lg:text-h2">
              Earning Has Never Been Simpler
            </p>

            <p className="max-w-96 text-leading text-secondary lg:max-w-[40.625rem] lg:text-center lg:text-smallSubheading">
              Just deposit USDC and watch the value grow.” OR “Start earning steady, risk-adjusted returns today — just
              deposit USDC.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            label="Step 1"
            title="Deposit"
            description="Deposit your stablecoins into Zivoe and receive czUSD."
            image={<Step1Icon />}
            className="items-end"
            imageClassName="pt-4 items-end   lg:max-w-[70%]"
          />

          <Card
            label="Step 2"
            title="Earn"
            description="czUSD automatically grows in value as interest is earned."
            image={<Step2Icon />}
            className="items-end justify-start"
            imageClassName="items-end pt-3 max-w-[20rem] lg:max-w-fit lg:[&>svg]:w-full"
          />

          <Card
            label="Step 3"
            title="Cashout"
            description="Swap your czUSD back for stablecoins at any time."
            image={<Step3Icon />}
            className="items-center"
            imageClassName="max-w-[11rem] items-center lg:max-w-[70%]"
          />
        </div>
      </div>
    </Container>
  );
}

function Card({
  label,
  title,
  description,
  image,
  className,
  imageClassName
}: {
  label: string;
  title: string;
  description: string;
  image: ReactNode;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className="shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)] lg:max-w-full">
      <div
        className={cn(
          'flex h-[12.5rem] items-center justify-center bg-element-neutral-subtle lg:h-[18.75rem]',
          className
        )}
      >
        <div className={cn('flex h-full w-fit justify-center [&>svg]:h-full lg:[&>svg]:h-min', imageClassName)}>
          {image}
        </div>
      </div>
      <div className="flex flex-col gap-6 bg-element-neutral-light px-8 py-10 lg:gap-8">
        <p className="!font-heading text-small text-primary lg:text-regular">{label}</p>

        <div className="flex flex-col gap-3">
          <p className="!font-heading text-subheading text-primary">{title}</p>
          <p className="max-w-[17.5rem] text-regular text-secondary lg:text-leading">{description}</p>
        </div>
      </div>
    </div>
  );
}
