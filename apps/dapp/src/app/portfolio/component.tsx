'use client';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { skipToken, useQuery } from '@tanstack/react-query';
import { AreaChart, CartesianGrid, Area as ReArea, XAxis, YAxis } from 'recharts';

import { Button } from '@zivoe/ui/core/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Link } from '@zivoe/ui/core/link';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { ZVltLogo } from '@zivoe/ui/icons';
import { PiggyBankIcon, WalletIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { queryKeys } from '@/lib/query-keys';
import { customNumber, formatBigIntWithCommas, getEndOfDayUTC, handlePromise } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useIsMobile } from '@/hooks/useIsMobile';

import InfoSection from '@/components/info-section';

import { PortfolioData } from '../api/portfolio/route';
import { ApiResponseError, ApiResponseSuccess } from '../api/utils';

export default function PortfolioComponent() {
  return (
    <>
      <Header />
      <Chart />
      <Holdings />
    </>
  );
}

function Header() {
  const account = useAccount();
  const { data: portfolio, isFetching } = usePortfolio();

  if (account.isPending || isFetching) return <HeaderSkeleton />;

  const currentEndOfDayUTC = getEndOfDayUTC(new Date());
  const currentEndOfDayUTCString = currentEndOfDayUTC.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });

  return (
    <HeaderContainer>
      <p className="text-h4 text-primary">
        {portfolio?.value
          ? `$${formatBigIntWithCommas({ value: portfolio.value })}`
          : account.isDisconnected
            ? '$-'
            : '$0.00'}
      </p>

      <div className="flex items-center gap-1 text-regular">
        {portfolio?.change && (
          <span className={cn('font-medium', portfolio.change.isPositive ? 'text-brand-subtle' : 'text-alert-subtle')}>
            {portfolio.change.isPositive ? '+' : ''}
            {formatBigIntWithCommas({ value: portfolio.change.value, tokenDecimals: 2, displayDecimals: 2 })}%
          </span>
        )}

        <span className="text-secondary">
          {portfolio?.change ? 'on' : null} {currentEndOfDayUTCString} (UTC)
        </span>
      </div>
    </HeaderContainer>
  );
}

function HeaderSkeleton() {
  return (
    <HeaderContainer>
      <Skeleton className="h-10 w-44 rounded-md" />
      <Skeleton className="h-6 w-52 rounded-md" />
    </HeaderContainer>
  );
}

function HeaderContainer({ children }: { children: React.ReactNode }) {
  return (
    <InfoSection title="Portfolio Value" icon={<PiggyBankIcon />}>
      <div className="flex flex-col gap-2">{children}</div>
    </InfoSection>
  );
}

function Chart() {
  const isMobile = useIsMobile();
  const account = useAccount();
  const { data: portfolio, isFetching } = usePortfolio();

  if (account.isPending || isFetching) return <ChartSkeleton type="loading" />;
  if (account.isDisconnected) return <ChartSkeleton type="disconnected" />;
  if (!portfolio || portfolio.snapshots.length === 0) return <ChartSkeleton type="empty" />;

  const strokeColor =
    !portfolio.change || portfolio.change.isPositive ? 'hsl(var(--primary-600))' : 'hsl(var(--alert-700))';

  return (
    <div className="h-[288px] w-full [&>div]:!aspect-auto [&>div]:h-full">
      <ChartContainer config={{}}>
        <AreaChart accessibilityLayer data={portfolio.snapshots} margin={{ left: 10, right: 0, top: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />

          <XAxis
            dataKey="timestamp"
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tickFormatter={(value) =>
              value.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC'
              })
            }
          />

          <YAxis
            tickLine={false}
            hide={isMobile}
            axisLine={false}
            tickMargin={16}
            domain={[(dataMin: number) => dataMin * 0.95, (dataMax: number) => dataMax * 1.05]}
            tickFormatter={(value) => `$${customNumber(value)}`}
          />

          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                hideLabel
                formatter={(_, __, item) => {
                  const balance = item.payload.balance;

                  const timestamp = item.payload.timestamp;
                  const formattedDate = timestamp.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC'
                  });

                  return (
                    <div className="flex flex-col gap-1">
                      <span className="font-heading text-regular tabular-nums text-primary">
                        ${formatBigIntWithCommas({ value: balance })}
                      </span>

                      <span className="text-small text-secondary">{formattedDate}</span>
                    </div>
                  );
                }}
              />
            }
          />

          <defs>
            <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <ReArea
            dataKey="balanceNumeric"
            type="monotone"
            fill="url(#fillBalance)"
            stroke={strokeColor}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function ChartSkeleton({ type }: { type: 'loading' | 'disconnected' | 'empty' }) {
  const { setShowAuthFlow } = useDynamicContext();

  return (
    <div className="relative h-[288px] w-full overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 800 288" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skeleton-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--neutral-200))" stopOpacity="0.3" />
            <stop offset="95%" stopColor="hsl(var(--neutral-200))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Mobile path - fewer waves */}
        <path
          d="M 0 170 C 100 120, 200 120, 300 170 C 400 220, 500 220, 600 170 C 700 120, 750 120, 800 170 L 800 288 L 0 288 Z"
          fill="url(#skeleton-gradient)"
          className={cn('lg:hidden', type === 'loading' ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : '')}
        />

        {/* Desktop path - more waves */}
        <path
          d="M 0 170 C 33 120, 66 120, 100 170 C 133 220, 166 220, 200 170 C 233 120, 266 120, 300 170 C 333 220, 366 220, 400 170 C 433 120, 466 120, 500 170 C 533 220, 566 220, 600 170 C 633 120, 666 120, 700 170 C 733 220, 766 220, 800 170 L 800 288 L 0 288 Z"
          fill="url(#skeleton-gradient)"
          className={cn('hidden lg:block', type === 'loading' ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : '')}
        />

        {/* Mobile stroke - fewer waves */}
        <path
          d="M 0 170 C 100 120, 200 120, 300 170 C 400 220, 500 220, 600 170 C 700 120, 750 120, 800 170"
          fill="none"
          stroke="hsl(var(--neutral-200))"
          strokeWidth="2"
          strokeOpacity="0.6"
          className={cn('lg:hidden', type === 'loading' ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : '')}
        />

        {/* Desktop stroke - more waves */}
        <path
          d="M 0 170 C 33 120, 66 120, 100 170 C 133 220, 166 220, 200 170 C 233 120, 266 120, 300 170 C 333 220, 366 220, 400 170 C 433 120, 466 120, 500 170 C 533 220, 566 220, 600 170 C 633 120, 666 120, 700 170 C 733 220, 766 220, 800 170"
          fill="none"
          stroke="hsl(var(--neutral-200))"
          strokeWidth="2"
          strokeOpacity="0.6"
          className={cn('hidden lg:block', type === 'loading' ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : '')}
        />
      </svg>

      {type === 'disconnected' ? (
        <ChartSkeletonCard
          title="Connect Wallet to View Holdings"
          description="Your assets & balances will appear here"
        >
          <Button onPress={() => setShowAuthFlow(true)}>Connect Wallet</Button>
        </ChartSkeletonCard>
      ) : type === 'empty' ? (
        <ChartSkeletonCard
          title="You Don't Have Any Deposits, Yet"
          description="Open a position by depositing your assets"
        >
          <Link variant="primary" href="/">
            Deposit
          </Link>
        </ChartSkeletonCard>
      ) : null}
    </div>
  );
}

function ChartSkeletonCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h3 className="text-h7 text-primary">{title}</h3>
          <p className="text-regular text-secondary">{description}</p>
        </div>

        {children}
      </div>
    </div>
  );
}

function Holdings() {
  return (
    <InfoSection title="Holdings" icon={<WalletIcon />} className="w-full">
      <HoldingsContainer />
    </InfoSection>
  );
}

function HoldingsContainer() {
  const account = useAccount();
  const { data: portfolio, isFetching } = usePortfolio();

  if (account.isPending || isFetching)
    return (
      <HoldingsContent>
        <AssetInfo asset="zVLT" isLoading />
      </HoldingsContent>
    );

  if (account.isDisconnected)
    return (
      <HoldingsInfoCard
        title="Connect Wallet"
        description="Your holdings will appear here once you connect your wallet"
      />
    );

  if (!portfolio || !portfolio.zVLTBalance || !portfolio.value)
    return <HoldingsInfoCard title="No Positions" description="Your holdings will appear here once you deposit" />;

  return (
    <HoldingsContent>
      <AssetInfo
        asset="zVLT"
        balance={formatBigIntWithCommas({ value: portfolio.zVLTBalance })}
        value={`$${formatBigIntWithCommas({ value: portfolio.value })}`}
      />
    </HoldingsContent>
  );
}

function HoldingsInfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-[8.5rem] flex-col items-center justify-center gap-2 text-center">
      <h3 className="text-h7 text-primary">{title}</h3>
      <p className="text-regular text-secondary">{description}</p>
    </div>
  );
}

function HoldingsContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(320px,_1fr)_minmax(140px,_1fr)_minmax(140px,_1fr)_1fr] lg:grid-cols-[minmax(360px,_1fr)_minmax(200px,_1fr)_minmax(200px,_1fr)_1fr] xl:grid-cols-[minmax(360px,_1fr)_minmax(360px,_1fr)_minmax(360px,_1fr)_1fr]">
      <TableHeader title="Asset" />
      <TableHeader title="Balance" />
      <TableHeader title="Value" />
      <TableHeader title="" />

      {children}
    </div>
  );
}

function AssetInfo({
  asset,
  ...props
}: { asset: HoldingAsset } & ({ isLoading: true } | { balance: string; value: string })) {
  const info = HOLDING_INFO[asset];
  const isLoading = 'isLoading' in props;

  return (
    <>
      {/* Desktop View */}
      <TableElement>
        <div className="flex items-center gap-3">
          {info.icon}

          <div>
            <p className="text-regular text-primary">{info.title}</p>
            <p className="text-small text-secondary">{info.description}</p>
          </div>
        </div>
      </TableElement>

      <TableElement>
        {isLoading ? <AssetInfoSkeleton /> : <p className="text-regular text-primary">{props.balance}</p>}
      </TableElement>

      <TableElement>
        {isLoading ? <AssetInfoSkeleton /> : <p className="text-regular text-primary">{props.value}</p>}
      </TableElement>

      <TableElement className="justify-end">
        <Link variant="border" size="s" href="/">
          Deposit
        </Link>
      </TableElement>

      {/* Mobile View */}
      <div className="flex flex-col gap-4 rounded-xl border border-default p-5 md:hidden">
        <div className="flex items-center gap-3">
          {info.icon}

          <div>
            <p className="text-smallSubheading font-medium text-primary">{info.title}</p>
            <p className="text-small text-secondary">{info.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            {isLoading ? <AssetInfoSkeleton /> : <p className="text-h7 text-primary">{props.balance}</p>}
            <p className="text-small text-secondary">Balance</p>
          </div>

          <div>
            {isLoading ? <AssetInfoSkeleton /> : <p className="text-h7 text-primary">{props.value}</p>}
            <p className="text-small text-secondary">Value</p>
          </div>
        </div>

        <Link variant="border" size="m" fullWidth href="/">
          Deposit
        </Link>
      </div>
    </>
  );
}

function AssetInfoSkeleton() {
  return <Skeleton className="h-6 w-28 rounded-md" />;
}

type HoldingAsset = 'zVLT';
const HOLDING_INFO: Record<HoldingAsset, { title: string; description: string; icon: React.ReactNode }> = {
  zVLT: {
    title: 'zVLT',
    description: 'A nonprime consumer credit fund',
    icon: <ZVltLogo className="size-8 flex-shrink-0" />
  }
};

function TableHeader({ title }: { title: string }) {
  return (
    <div className="hidden bg-surface-elevated px-4 py-2 md:block">
      <p className="text-small text-secondary">{title}</p>
    </div>
  );
}

function TableElement({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('hidden h-[5.25rem] items-center px-4 md:flex', className)}>{children}</div>;
}

const DEFAULT_ERROR_MESSAGE = 'Failed to fetch portfolio';
const usePortfolio = () => {
  const { address } = useAccount();

  const skip = !address;

  return useQuery({
    queryKey: queryKeys.account.portfolio({ accountAddress: address }),
    queryFn: skip
      ? skipToken
      : async () => {
          const { err, res } = await handlePromise(fetch(`/api/portfolio?address=${encodeURIComponent(address)}`));
          if (err || !res) throw new Error(DEFAULT_ERROR_MESSAGE);

          if (!res.ok) {
            const errorData = (await res.json().catch(() => ({ error: DEFAULT_ERROR_MESSAGE }))) as ApiResponseError;
            throw new Error(errorData.error);
          }

          const portfolio = (await res.json()) as ApiResponseSuccess<PortfolioData>;
          if (!portfolio.data) throw new Error(DEFAULT_ERROR_MESSAGE);

          const apiSnapshots = portfolio.data.snapshots.map((snapshot) => {
            const timestamp = new Date(Number(snapshot.timestamp) * 1000);
            const balance = BigInt(snapshot.balance);
            const balanceNumeric = Number(balance) / 1e18; // Convert to decimal for charting

            return { timestamp, balance, balanceNumeric };
          });

          const portfolioEndDate = portfolio.data.timestamp ? new Date(Number(portfolio.data.timestamp) * 1000) : null;
          const filledSnapshots = fillMissingDays(apiSnapshots, portfolioEndDate);

          // Calculate portfolio change
          let change: { value: bigint; isPositive: boolean } | null = null;

          if (filledSnapshots.length > 1) {
            const firstBalance = filledSnapshots[0]?.balance;
            const lastBalance = filledSnapshots[filledSnapshots.length - 1]?.balance;

            console.log(firstBalance, lastBalance);

            if (firstBalance && firstBalance !== 0n && lastBalance) {
              const changeValue = ((lastBalance - firstBalance) * 10n ** 4n) / firstBalance;
              change = { value: changeValue, isPositive: changeValue >= 0n };
            }
          }

          return {
            zVLTBalance: portfolio.data.zVLTBalance ? BigInt(portfolio.data.zVLTBalance) : null,
            value: portfolio.data.value ? BigInt(portfolio.data.value) : null,
            timestamp: portfolio.data.timestamp ? new Date(Number(portfolio.data.timestamp) * 1000) : null,
            snapshots: filledSnapshots,
            change
          };
        }
  });
};

type Snapshot = {
  timestamp: Date;
  balance: bigint;
  balanceNumeric: number;
};

function fillMissingDays(snapshots: Array<Snapshot>, portfolioTimestamp: Date | null) {
  const firstSnapshot = snapshots[0];
  if (!firstSnapshot || !portfolioTimestamp) return [];

  const result: Array<Snapshot> = [];

  let currentDay = firstSnapshot.timestamp;
  let lastBalance = firstSnapshot.balance;
  let lastBalanceNumeric = firstSnapshot.balanceNumeric;
  let apiIndex = 0;

  while (currentDay <= portfolioTimestamp) {
    const apiSnapshot = snapshots[apiIndex];

    const isMatchingDay = apiSnapshot && apiSnapshot.timestamp.getTime() === currentDay.getTime();

    if (isMatchingDay) {
      lastBalance = apiSnapshot.balance;
      lastBalanceNumeric = apiSnapshot.balanceNumeric;
      apiIndex++;
    }

    result.push({
      timestamp: new Date(currentDay), // Create new Date to avoid mutation
      balance: lastBalance,
      balanceNumeric: lastBalanceNumeric
    });

    currentDay = new Date(currentDay.getTime() + 24 * 60 * 60 * 1000);
  }

  return result;
}
