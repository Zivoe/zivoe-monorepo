import { Suspense } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { CreditIcon, DollarIcon, DropIcon } from '@zivoe/ui/icons';

import { data } from '@/server/data';

import { formatBigIntToReadable } from '@/lib/utils';

import Page from '@/components/page';

import AUMAccordion, { AUMAccordionSkeleton } from './_components/aum/aum-accordion';
import AUMDonutChart, { AUMDonutChartSkeleton } from './_components/aum/aum-donut-chart';
import { Card } from './_components/card';
import { NewCoIcon } from './_components/icons/newco';
import { ZinclusiveIcon } from './_components/icons/zinclusive';
import Liquidity from './_components/liquidity';
import LiquidityChart from './_components/liquidity-chart';
import LoanCard from './_components/loans';
import { ZIVOE_ZAPPER_URL } from './_utils/constants';

export default async function TransparencyPage() {
  return (
    <div className="bg-surface-base">
      <Page className="flex gap-10">
        <div className="space-y-2">
          <h1 className="text-h3 text-primary">Transparency</h1>
          <p className="text-regular text-secondary">Access real-time data and reports about zVLT</p>
        </div>

        <Card>
          <Card.Header title="Assets Under Management" titleSmall="AUM" icon={<DollarIcon />}>
            <Link size="m" href={ZIVOE_ZAPPER_URL} target="_blank">
              View Wallets
            </Link>
          </Card.Header>

          <Card.Body>
            <Suspense
              fallback={
                <div className="flex w-full flex-col items-center gap-12 lg:flex-row">
                  <AUMDonutChartSkeleton />
                  <AUMAccordionSkeleton />
                </div>
              }
            >
              <AssetsUnderManagement />
            </Suspense>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header title="Loans" icon={<CreditIcon />} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Suspense
              fallback={
                <>
                  <Card.Body className="h-[38rem] animate-pulse sm:h-[28.25rem]" />
                  <Card.Body className="h-[38rem] animate-pulse sm:h-[28.25rem]" />
                </>
              }
            >
              <Card.Body>
                <ZinclusiveLoan />
              </Card.Body>

              <Card.Body>
                <NewCoLoan />
              </Card.Body>
            </Suspense>
          </div>
        </Card>

        <Card>
          <Card.Header title="Liquidity" icon={<DropIcon />} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Suspense
              fallback={
                <>
                  <Card.Body className="h-[38rem] animate-pulse sm:h-[28.25rem]" />
                  <Card.Body className="h-[38rem] animate-pulse sm:h-[28.25rem]" />
                </>
              }
            >
              <LiquidityWrapper />
            </Suspense>
          </div>
        </Card>
      </Page>
    </div>
  );
}

async function AssetsUnderManagement() {
  const currentDailyData = await data.getCurrentDailyData();
  if (!currentDailyData) return null;

  const tvl = currentDailyData.tvl;

  return (
    <div className="flex w-full flex-col items-center gap-12 lg:flex-row">
      <AUMDonutChart data={tvl} />
      <AUMAccordion data={tvl} />
    </div>
  );
}

async function ZinclusiveLoan() {
  const loans = await data.getTransparencyLoansData();
  if (!loans) return null;

  return (
    <LoanCard
      image={<ZinclusiveIcon />}
      title="Portfolio A"
      description="Consumer Credit"
      info="Zivoe provides a fixed-rate credit facility to a U.S.-based consumer lender for the purpose of originating and funding consumer loans."
      investmentValue={formatBigIntToReadable(BigInt(loans.zinclusive.invested), 18)}
      interestEarned={formatBigIntToReadable(BigInt(loans.zinclusive.interest), 6)}
      averageLoanSize="$3,300"
      geography="Americas"
    />
  );
}

async function NewCoLoan() {
  const loans = await data.getTransparencyLoansData();
  if (!loans) return null;

  const { newCo } = loans;

  return (
    <LoanCard
      image={<NewCoIcon />}
      title="Portfolio B"
      description="Merchant Cash Advance"
      info="Zivoe owns an interest in a portfolio of merchant cash advance loans originated and serviced by a leading SME finance provider. The portfolio supports small and medium-sized businesses across North America."
      investmentValue={formatBigIntToReadable(BigInt(newCo.invested), 18)}
      interestEarned={formatBigIntToReadable(BigInt(newCo.interest), 6)}
      averageLoanSize="$3,829"
      geography="Americas"
    />
  );
}

async function LiquidityWrapper() {
  const liquidity = await data.getLiquidity();
  if (!liquidity) return null;

  return (
    <>
      <Card.Body>
        <Liquidity data={liquidity} />
      </Card.Body>

      <Card.Body>
        <LiquidityChart data={liquidity} />
      </Card.Body>
    </>
  );
}
