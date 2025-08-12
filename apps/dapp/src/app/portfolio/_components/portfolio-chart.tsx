'use client';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { AreaChart, CartesianGrid, Area as ReArea, XAxis, YAxis } from 'recharts';

import { Button } from '@zivoe/ui/core/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Link } from '@zivoe/ui/core/link';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { customNumber, formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useIsMobile } from '@/hooks/useIsMobile';

import { usePortfolio } from '../_hooks/usePortfolio';

export function PortfolioChart() {
  const isMobile = useIsMobile();
  const account = useAccount();
  const { data: portfolio, isFetching } = usePortfolio();

  if (account.isPending || isFetching) return <ChartSkeleton type="loading" />;
  if (account.isDisconnected) return <ChartSkeleton type="disconnected" />;
  if (!portfolio || portfolio.snapshots.length === 0) return <ChartSkeleton type="empty" />;

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
              <stop offset="5%" stopColor="hsl(var(--primary-600))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary-600))" stopOpacity={0} />
            </linearGradient>
          </defs>

          <ReArea
            dataKey="balanceNumeric"
            type="monotone"
            fill="url(#fillBalance)"
            stroke="hsl(var(--primary-600))"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function ChartSkeleton({ type }: { type: 'loading' | 'disconnected' | 'empty' }) {
  const { setShowAuthFlow } = useDynamicContext();

  const color = type === 'loading' ? 'hsl(var(--neutral-300))' : 'hsl(var(--neutral-200))';

  return (
    <div className="relative h-[288px] w-full overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 800 288" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skeleton-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity="0.3" />
            <stop offset="95%" stopColor={color} stopOpacity="0" />
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
          stroke={color}
          strokeWidth="2"
          strokeOpacity="0.6"
          className={cn('lg:hidden', type === 'loading' ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : '')}
        />

        {/* Desktop stroke - more waves */}
        <path
          d="M 0 170 C 33 120, 66 120, 100 170 C 133 220, 166 220, 200 170 C 233 120, 266 120, 300 170 C 333 220, 366 220, 400 170 C 433 120, 466 120, 500 170 C 533 220, 566 220, 600 170 C 633 120, 666 120, 700 170 C 733 220, 766 220, 800 170"
          fill="none"
          stroke={color}
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
