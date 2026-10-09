'use client';

import { useState } from 'react';

import { AreaChart, CartesianGrid, Area as ReArea, XAxis, YAxis } from 'recharts';
import { type Address } from 'viem';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { customNumber, formatUsdD18 } from '@/lib/utils';

import { useIsMobile } from '@/hooks/useIsMobile';

import { dayTicks, formatDayLabel, formatLocalDayLabel, stepDecimals, valueAxis } from '@/components/chart/axis';
import { DayTick } from '@/components/chart/day-tick';
import TextSkeleton from '@/components/text-skeleton';
import { getTokenInfo } from '@/components/token-info';

import { type TransactionIdentity } from '@/centrifuge';
import {
  type Amounts,
  HISTORY_RANGES,
  type HistoryRange,
  availableRanges,
  selectRange,
  usePortfolioHistory
} from '@/portfolio';

import { balanceChartSubtitle, formatAmount } from './format';

/**
 * The value of the share tokens in the wallet over time. What the wallet
 * holds and nothing else: shares in a redemption queue leave the wallet on
 * request and are shown as such in the hero and the Tokens card. No change
 * line on purpose — deposits and redemptions move this figure far more than
 * the share price does, and a performance figure needs its own model.
 */
export function BalanceChart({
  identities,
  accountAddress,
  shareSymbol,
  shareAmounts
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  accountAddress: Address;
  shareSymbol: string;
  /** The share token across every chain once all have answered; what of it sits outside the wallet is named under the headline. */
  shareAmounts: Amounts | undefined;
}) {
  const { history, status, liveStatus, isTruncated, nowMs, refetch } = usePortfolioHistory({
    identities,
    accountAddress
  });
  const isMobile = useIsMobile();
  const [chosen, setChosen] = useState<HistoryRange>('30D');

  // A range the history cannot fill is offered greyed out and never selected,
  // so "the past 90 days" never labels six weeks of data.
  const available = availableRanges({ history, nowMs });
  const range = available.includes(chosen) ? chosen : 'All';
  const data = selectRange({ history, range, nowMs }).map((point) => ({
    ts: point.timestampMs,
    value: Number(point.valueD18) / 1e18,
    valueD18: point.valueD18,
    // Day closes are UTC days; today's point is a moment, dated in the reader's own time zone.
    label: point === history.livePoint ? formatLocalDayLabel(point.timestampMs) : formatDayLabel(point.timestampMs)
  }));

  // A 5% floor on the window keeps a sub-cent week from filling the plot.
  const values = data.map((point) => point.value);
  const axis = valueAxis({ values, minSpan: Math.max(Math.max(0, ...values) * 0.05, 0.05) });
  const tickDecimals = stepDecimals(axis.step);
  const xTicks = dayTicks({ firstTs: data[0]?.ts, lastTs: data.at(-1)?.ts, maxLabels: isMobile ? 4 : 7 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="[&_svg]:size-5">{getTokenInfo(shareSymbol)?.icon}</span>
          {shareSymbol} balance
        </CardTitle>
        <div role="group" aria-label="History range" className="flex gap-1">
          {HISTORY_RANGES.map((candidate) => (
            <Button
              key={candidate}
              size="s"
              variant="ghost-light"
              aria-pressed={candidate === range}
              isDisabled={!available.includes(candidate)}
              onPress={() => setChosen(candidate)}
              className={cn(
                'px-2.5 hover:bg-element-primary-gentle hover:text-primary',
                candidate === range && 'bg-surface-base text-primary shadow-xs hover:bg-surface-base'
              )}
            >
              {candidate}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-heading! text-h4 text-primary">
            {history.livePoint ? (
              formatUsdD18(history.livePoint.valueD18)
            ) : liveStatus === 'error' ? (
              '—'
            ) : (
              <TextSkeleton className="w-28" />
            )}
          </p>
          {/* The same share figure as the Tokens row, so the two cards read as one number. */}
          <p className="text-regular font-medium text-primary tabular-nums">
            {shareAmounts ? (
              formatAmount(shareAmounts.wallet, shareSymbol)
            ) : liveStatus === 'error' ? (
              '—'
            ) : (
              <TextSkeleton className="w-20" />
            )}
          </p>
          <p className="text-small text-secondary">{balanceChartSubtitle({ shareSymbol, shareAmounts })}</p>
        </div>

        {status === 'pending' ? (
          <ChartPlotSkeleton />
        ) : status === 'error' ? (
          <Callout variant="warning">
            Could not load your balance history.{' '}
            <Button variant="link-primary" size="s" onPress={refetch}>
              Retry
            </Button>
          </Callout>
        ) : data.length < 2 ? (
          <p className="py-10 text-center text-small text-secondary">
            {history.livePoint && history.livePoint.valueD18 > 0n
              ? 'Your balance history starts once the first day closes.'
              : `No ${shareSymbol} in this wallet yet.`}
          </p>
        ) : (
          <ChartContainer config={{}}>
            <AreaChart accessibilityLayer data={data} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="linear"
                domain={['dataMin', 'dataMax']}
                ticks={xTicks}
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={DayTick}
              />
              <YAxis
                tickLine={false}
                hide={isMobile}
                axisLine={false}
                minTickGap={20}
                width={60}
                scale="linear"
                domain={axis.domain}
                ticks={axis.ticks}
                // The vault chart's compact axis: k/M above a thousand, step-matched decimals below, no currency sign.
                tickFormatter={(value: number) => (value >= 1000 ? customNumber(value) : value.toFixed(tickDecimals))}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    hideLabel
                    formatter={(_value, _name, item) => {
                      const point = item.payload as (typeof data)[number];
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="font-heading! text-regular text-primary tabular-nums">
                            {formatUsdD18(point.valueD18)}
                          </span>
                          <span className="text-small text-secondary">{point.label}</span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <defs>
                <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="39.55%" stopColor="hsl(var(--primary-600))" stopOpacity={0.1} />
                  <stop offset="100.17%" stopColor="hsl(var(--primary-600))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              {/* Drawn like the vault's Token Price chart: one close per day, joined by straight segments. */}
              <ReArea dataKey="value" type="linear" fill="url(#fillBalance)" stroke="hsl(var(--primary-600))" />
            </AreaChart>
          </ChartContainer>
        )}

        {isTruncated && status === 'success' && (
          <p className="text-extraSmall text-secondary">The oldest part of this history could not be loaded.</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The plot's silhouette: gridlines with their labels, a row of day labels,
 * and a soft, pulsing area with a gently rising top edge — the same grey as
 * every other skeleton block, shaped like a chart.
 */
function ChartPlotSkeleton() {
  return (
    <div aria-hidden="true" className="flex aspect-video w-full flex-col gap-2 pt-2.5">
      <div className="relative flex flex-1 flex-col justify-between">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-3 w-12 shrink-0 rounded-sm" />
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
        ))}
        {/* Stretched to the plot. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-y-1.5 right-0 left-16 h-[calc(100%-0.75rem)] w-[calc(100%-4rem)] animate-pulse motion-reduce:animate-none"
        >
          {/* The skeleton grey, like the pulsing blocks around it. */}
          <path d={`${MOCK_BALANCE_PATH} V100 H0 Z`} fill="hsl(var(--neutral-200))" />
        </svg>
      </div>
      <div className="flex justify-between pl-16">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-3 w-10 rounded-sm" />
        ))}
      </div>
    </div>
  );
}

const MOCK_BALANCE_PATH = 'M0 78 C 8 76, 14 68, 22 70 S 36 62, 44 56 S 56 50, 64 42 S 80 36, 88 28 S 96 24, 100 22';

/** The whole card while the page's data is on its way: the real title, pulsing range chips, headline and plot. */
export function BalanceChartSkeleton({ shareSymbol }: { shareSymbol: string }) {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <CardTitle>
          <span className="[&_svg]:size-5">{getTokenInfo(shareSymbol)?.icon}</span>
          {shareSymbol} balance
        </CardTitle>
        <div className="flex gap-1">
          {HISTORY_RANGES.map((range) => (
            <Skeleton key={range} className="h-8 w-10 rounded-xs" />
          ))}
        </div>
      </CardHeader>
      <CardContent className="gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-heading! text-h4 text-primary">
            <TextSkeleton className="w-28" />
          </p>
          <p className="text-regular font-medium text-primary">
            <TextSkeleton className="w-20" />
          </p>
          <p className="text-small text-secondary">
            <TextSkeleton className="w-56" />
          </p>
        </div>
        <ChartPlotSkeleton />
      </CardContent>
    </Card>
  );
}
