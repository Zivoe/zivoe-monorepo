import { ReactNode, Suspense } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { ChartLightIcon, GlobeIcon, MoneyHandIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { web3 } from '@/server/web3';

import { formatBigIntWithCommas } from '@/lib/utils';

import Container from '@/components/container';

import Globe from './globe';

export default function Portfolio() {
  return (
    <div className="bg-element-primary-subtle">
      <Container className="w-full items-center justify-between gap-10 py-20 sm:gap-20 sm:px-10 md:w-[35rem] md:px-0 xl:w-auto xl:flex-row xl:items-center xl:gap-24 xl:px-[8.75rem] xl:py-0">
        <div className="flex flex-col gap-10 xl:gap-20 xl:py-[15.375rem]">
          <div className="flex flex-col gap-4">
            <p className="text-h5 text-base sm:text-h3 xl:max-w-[30.875rem] xl:text-h2">
              Meet the Portfolio Behind the Performance
            </p>
            <p className="text-base/80 xl:max-w-[25rem] xl:text-leading">
              Earn yield from a well-diversified private credit portfolio.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <Suspense fallback={<LoanPortfolioSkeleton />}>
              <LoanPortfolio />
            </Suspense>

            <Card title="Average Loan Size" description="$3,300">
              <CardIcon className="bg-primary-400">
                <ChartLightIcon />
              </CardIcon>
            </Card>

            <Card title="Geography" description="Americas">
              <CardIcon className="bg-[#84DAC0]">
                <GlobeIcon />
              </CardIcon>
            </Card>
          </div>

          <Link variant="primary-light" href="https://app.zivoe.com/transparency" target="_blank" hideExternalLinkIcon>
            View Portfolio
          </Link>
        </div>

        <Globe />
      </Container>
    </div>
  );
}

function LoanPortfolioSkeleton() {
  return (
    <LoanPortfolioSection description={<Skeleton className="h-7 w-32 rounded-md bg-element-primary-light/10" />} />
  );
}

async function LoanPortfolio() {
  const currentDailyData = await web3.getCurrentDailyData();
  if (!currentDailyData) return null;

  const loanPortfolio = currentDailyData.tvl.loans.total;

  return (
    <LoanPortfolioSection
      description={`$${formatBigIntWithCommas({ value: BigInt(loanPortfolio), tokenDecimals: 18, displayDecimals: 0 })}`}
    />
  );
}

function LoanPortfolioSection({ description }: { description: string | ReactNode }) {
  return (
    <Card title="Loan Portfolio" description={description}>
      <CardIcon className="bg-element-secondary">
        <MoneyHandIcon />
      </CardIcon>
    </Card>
  );
}

function Card({
  children,
  title,
  description
}: {
  children: ReactNode;
  title: string;
  description: string | ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-6 rounded-xl bg-element-primary px-6 py-4 sm:flex-col sm:items-start xl:flex-row xl:items-center xl:pb-4 xl:pt-6 2xl:w-[13.75rem] 2xl:flex-col 2xl:items-start">
      {children}

      <div className="flex flex-col gap-1">
        <p className="text-small text-base/80">{title}</p>

        {typeof description === 'string' ? (
          <p className="!font-heading text-smallSubheading text-base xl:text-subheading">{description}</p>
        ) : (
          description
        )}
      </div>
    </div>
  );
}

function CardIcon({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('h-fit w-fit rounded-[4px] p-2', className)}>{children}</div>;
}
