import { ReactNode } from 'react';
import React from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from '@/components/container';

import { Step1Icon, Step2Icon, Step3Icon } from './assets';

export default function HowItWorks() {
  return (
    <Container className="w-fit justify-between gap-20 py-10 sm:px-10 sm:py-20 md:w-[35rem] md:px-0 xl:w-auto xl:flex-row xl:items-start xl:px-[6.5rem] xl:py-[10rem] 2xl:px-[12rem]">
      <div className="flex w-full flex-col gap-10 sm:items-center sm:gap-16 xl:gap-20">
        <div className="flex flex-col gap-8 sm:items-center">
          <p className="!font-heading text-small text-primary sm:text-leading">
            Built For Institutions, Perfect For Retail
          </p>

          <div className="flex flex-col gap-4 sm:items-center">
            <p className="text-h6 text-primary sm:text-center sm:text-h4 xl:text-h2">Earning Has Never Been Simpler</p>

            <p className="text-leading text-secondary sm:text-center sm:text-smallSubheading">
              Start earning steady, risk-adjusted returns today — just deposit USDC.
            </p>
          </div>
        </div>

        <div className="grid w-full gap-6 xl:grid-cols-3">
          <Card
            label="Step 1"
            title="Deposit"
            description="Deposit your stablecoins into Zivoe and receive zVLT."
            image={<Step1Icon />}
            className="items-end"
            imageClassName="pt-4 items-end   sm:max-w-[70%]"
          />

          <Card
            label="Step 2"
            title="Earn"
            description="zVLT automatically grows in value as interest is earned."
            image={<Step2Icon />}
            className="w-full min-w-full flex-1 items-end justify-start"
            imageClassName="items-end pt-3 max-w-[20rem] sm:w-full sm:max-w-max w-full flex-1 sm:[&>svg]:w-full"
          />

          <Card
            label="Step 3"
            title="Redeem"
            description="Redeem your zVLT back for USDC instantly, subject to liquidity availability."
            image={<Step3Icon />}
            className="items-center"
            imageClassName="max-w-[11rem] items-center sm:max-w-[70%]"
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
    <div className="shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)] sm:max-w-full">
      <div
        className={cn(
          'flex h-[12.5rem] items-center justify-center rounded-t-xl bg-element-neutral-subtle sm:h-[18.75rem]',
          className
        )}
      >
        <div className={cn('flex h-full w-fit justify-center [&>svg]:h-full sm:[&>svg]:h-min', imageClassName)}>
          {image}
        </div>
      </div>
      <div className="flex flex-col gap-6 rounded-b-xl bg-element-neutral-light px-8 py-10 sm:gap-8">
        <p className="!font-heading text-small text-primary sm:text-regular">{label}</p>

        <div className="flex flex-col gap-3">
          <p className="!font-heading text-subheading text-primary">{title}</p>
          <p className="max-w-[17.5rem] text-regular text-secondary sm:text-leading">{description}</p>
        </div>
      </div>
    </div>
  );
}
