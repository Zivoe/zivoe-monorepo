import { ReactNode } from 'react';

import { ChartLightIcon, GlobeIcon, MoneyHandIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from '@/components/container';

import Globe from './globe';

export default function Portfolio() {
  return (
    <div className="bg-element-primary-subtle">
      <Container className="w-full items-center justify-between gap-20 py-20 lg:w-auto lg:flex-row lg:gap-24 lg:px-[8.75rem] lg:py-0">
        <div className="flex flex-col gap-10 lg:gap-20 lg:py-[15.375rem]">
          <div className="flex flex-col gap-4">
            <p className="max-w-[19.375rem] text-h5 text-base lg:max-w-[30.875rem] lg:text-h3 xl:text-h2">
              Meet the Portfolio Behind the Performance
            </p>
            <p className="max-w-[14.5rem] text-base/80 lg:max-w-[25rem] lg:text-leading">
              Invest with confidence in a well-diversified portfolio of retail loans.
            </p>
          </div>

          <div className="grid gap-3 2xl:grid-cols-3">
            <Card title="Lent so far" description="$6,000,000">
              <CardIcon className="bg-element-secondary">
                <MoneyHandIcon />
              </CardIcon>
            </Card>

            <Card title="Average Loan Size" description="$2k-$10k">
              <CardIcon className="bg-primary-400">
                <ChartLightIcon />
              </CardIcon>
            </Card>

            <Card title="Geogragphy" description="United States">
              <CardIcon className="bg-[#84DAC0]">
                <GlobeIcon />
              </CardIcon>
            </Card>
          </div>
        </div>

        <Globe />
      </Container>
    </div>
  );
}

function Card({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return (
    <div className="flex w-full items-center gap-6 rounded-lg bg-element-primary px-6 py-4 lg:pb-4 lg:pt-6 2xl:w-[13.75rem] 2xl:flex-col 2xl:items-start">
      {children}

      <div className="flex flex-col gap-1">
        <p className="text-small text-base/80">{title}</p>
        <p className="text-smallSubheading text-base lg:text-subheading">{description}</p>
      </div>
    </div>
  );
}

function CardIcon({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('h-fit w-fit rounded-[4px] p-2', className)}>{children}</div>;
}
