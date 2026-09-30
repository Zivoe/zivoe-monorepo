import { useEffect, useMemo, useRef, useState } from 'react';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatUnits } from 'viem';

import { Button } from '@zivoe/ui/core/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { ZSmbLogo } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { HISTORY_RANGES, type HistoryRange, type WalletHistory, selectHistory } from '@/portfolio/history';

import { walletValueAxis } from './chart-axis';
import { Card, dateLabel } from './common';

const balanceDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const balanceTooltipDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
});
const balanceMoney = (value: bigint | null, formatter = balanceDollars) =>
  value === null ? '—' : formatter.format(Number(formatUnits(value, 18)));
const rangeLabels: Record<HistoryRange, string> = {
  '7D': 'over the past 7 days',
  '30D': 'over the past 30 days',
  '90D': 'over the past 90 days',
  '1Y': 'over the past year',
  All: 'all time'
};

function useAxisWidth(labels: Array<string>) {
  const chartRef = useRef<HTMLDivElement>(null);
  const key = labels.join('\0');
  const estimate = Math.max(0, ...labels.map((label) => label.length * 8)) + 20;
  const [measured, setMeasured] = useState<{ key: string; width: number }>();

  useEffect(() => {
    const chart = chartRef.current;
    const context = document.createElement('canvas').getContext('2d');
    if (!chart || !context) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const tick = chart.querySelector('.recharts-yAxis .recharts-cartesian-axis-tick-value');
      const style = getComputedStyle(tick ?? chart);
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const letterSpacing = parseFloat(style.letterSpacing) || 0;
      const width =
        Math.ceil(
          Math.max(0, ...labels.map((label) => context.measureText(label).width + label.length * letterSpacing))
        ) + 20;
      setMeasured((previous) => (previous?.key === key && previous.width === width ? previous : { key, width }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(chart);
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [key, labels]);

  return { chartRef, width: measured?.key === key ? measured.width : estimate };
}

export function WalletChart({
  history,
  nowMs,
  loading,
  error,
  refresh
}: {
  history: WalletHistory;
  nowMs: number;
  loading: boolean;
  error: boolean;
  refresh: () => void;
}) {
  const [range, setRange] = useState<HistoryRange>('30D');
  const selected = useMemo(() => selectHistory(history, range, nowMs), [history, range, nowMs]);
  const data = useMemo(
    () =>
      selected.points.map((point) => ({
        ...point,
        value: point.valueD18 === null ? null : Number(formatUnits(point.valueD18, 18))
      })),
    [selected.points]
  );
  const axis = useMemo(() => walletValueAxis(data.map((point) => point.value)), [data]);
  const { chartRef, width: axisWidth } = useAxisWidth(axis.labels);
  const known = data.filter((point) => point.value !== null);
  const current = data.at(-1)?.valueD18 ?? null;
  const change = selected.changeD18;
  return (
    <Card
      title="zSMB Balance"
      titleIcon={<ZSmbLogo aria-hidden="true" focusable="false" className="size-6 shrink-0" />}
      className="order-1"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading! text-h4 text-primary">{balanceMoney(current)}</p>
          <p className="mt-2 text-small text-secondary" aria-live="polite">
            <span
              className={cn(
                'font-medium tabular-nums',
                change !== null && change > 0n && 'text-success',
                change !== null && change < 0n && 'text-alert'
              )}
            >
              {change !== null && change > 0n ? '+' : ''}
              {balanceMoney(change)}
            </span>{' '}
            {rangeLabels[range]}
          </p>
        </div>
        <div className="flex gap-1" aria-label="History range">
          {HISTORY_RANGES.map((item) => (
            <Button
              key={item}
              size="s"
              variant={range === item ? 'primary-light' : 'ghost-light'}
              aria-pressed={range === item}
              onPress={() => setRange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>
      {known.length > 1 ? (
        <ChartContainer
          ref={chartRef}
          config={{ value: { label: 'Wallet value', color: 'hsl(var(--secondary-700))' } }}
          className="mt-8 aspect-auto h-64 w-full"
        >
          <AreaChart accessibilityLayer data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} horizontalValues={axis.ticks} syncWithTicks />
            <XAxis
              dataKey="timestampMs"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) =>
                new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
              }
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={axis.domain}
              ticks={axis.ticks}
              interval={0}
              tickLine={{ stroke: 'hsl(var(--neutral-300))' }}
              tickSize={4}
              axisLine={false}
              width={axisWidth}
              tickMargin={8}
              tickFormatter={axis.formatTick}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload ? dateLabel(payload[0].payload.timestampMs) : ''
                  }
                  formatter={(_, __, item) => balanceMoney(item.payload?.valueD18 ?? null, balanceTooltipDollars)}
                />
              }
            />
            <defs>
              <linearGradient id="portfolio-value-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--secondary-200))" stopOpacity={0.8} />
                <stop offset="100%" stopColor="hsl(var(--secondary-200))" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <Area
              type="linear"
              dataKey="value"
              stroke="hsl(var(--secondary-700))"
              fill="url(#portfolio-value-fill)"
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="flex h-52 items-center justify-center text-center text-small text-secondary">
          {loading
            ? 'Loading wallet history…'
            : known.length === 1
              ? 'One value recorded. More history is needed to show a change.'
              : 'Wallet value history is unavailable.'}
        </div>
      )}
      {(error || (!loading && !history.complete)) && (
        <p className="mt-3 text-extraSmall text-secondary">
          {error
            ? 'History could not be loaded.'
            : history.missingPrices
              ? 'Some historical Token Prices are missing. Gaps are left unpriced.'
              : 'History is incomplete or still catching up with your wallet.'}{' '}
          <Button variant="link-primary" size="s" onPress={refresh}>
            Retry
          </Button>
        </p>
      )}
    </Card>
  );
}
