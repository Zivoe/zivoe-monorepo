'use client';

import { useState } from 'react';

import { type Key } from 'react-aria-components';
import { AreaChart, CartesianGrid, Area as ReArea, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { ChartIcon } from '@zivoe/ui/icons';

import { type CentrifugeDailySnapshot } from '@/server/data';

import { customNumber } from '@/lib/utils';

import { useIsMobile } from '@/hooks/useIsMobile';

const CHART_TYPES = ['Share Price', 'NAV', 'APY'] as const;
type ChartType = (typeof CHART_TYPES)[number];

const CHART_SELECT_ITEMS = CHART_TYPES.map((type, index) => ({ id: index, label: type }));

export default function DepositCharts({ snapshots }: { snapshots: Array<CentrifugeDailySnapshot> }) {
  const isMobile = useIsMobile();

  const [selectedChartType, setSelectedChartType] = useState<Key>(0);

  const chart = parseChartData({ snapshots, typeIndex: selectedChartType });
  if (!chart) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-between gap-2">
        {chart.currentValue !== undefined && (
          <p className="text-h4 text-primary">{formatChartValue(chart.type, chart.currentValue)}</p>
        )}

        <Select
          placeholder="Select"
          aria-label="Select a chart view"
          value={selectedChartType}
          onChange={(key) => setSelectedChartType(key ?? 0)}
        >
          <SelectTrigger>
            <ChartIcon className="size-4 text-icon-default" />
            <SelectValue />
          </SelectTrigger>

          <SelectPopover>
            <SelectListBox items={CHART_SELECT_ITEMS}>
              {(item) => (
                <SelectItem key={item.id} showCheckmark={false}>
                  {item.label}
                </SelectItem>
              )}
            </SelectListBox>
          </SelectPopover>
        </Select>
      </div>

      <div className="w-full">
        <ChartContainer config={{}}>
          <AreaChart accessibilityLayer data={chart.data} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />

            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tickFormatter={(value) => value.replace(/\s\d{4}$/, '')}
            />

            <YAxis
              tickLine={false}
              hide={isMobile}
              axisLine={false}
              minTickGap={20}
              width={60}
              scale="linear"
              domain={chart.domain}
              ticks={chart.ticks}
              tickFormatter={(value) => (chart.type === 'NAV' ? customNumber(value) : value)}
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  hideLabel
                  formatter={(value, _, item) => {
                    const date = item.payload.day;

                    return (
                      <div className="flex flex-col gap-1">
                        <span className="font-heading! text-regular tabular-nums text-primary">
                          {formatChartValue(chart.type, Number(value))}
                        </span>
                        <span className="text-small text-secondary">{date}</span>
                      </div>
                    );
                  }}
                />
              }
            />

            <defs>
              <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="39.55%" stopColor="hsl(var(--primary-600))" stopOpacity={0.1} />
                <stop offset="100.17%" stopColor="hsl(var(--primary-600))" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <ReArea dataKey="data" type="linear" fill="url(#fillPrice)" stroke="hsl(var(--primary-600))" />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}

function formatChartValue(type: ChartType, value: number) {
  if (type === 'APY') return `${customNumber(value)}%`;
  return `$${customNumber(value, type === 'Share Price' ? 3 : 2)}`;
}

const parseChartData = ({
  snapshots,
  typeIndex
}: {
  snapshots: Array<CentrifugeDailySnapshot>;
  typeIndex: Key;
}) => {
  const type = CHART_TYPES[Number(typeIndex)];
  if (!type) return undefined;

  const data = snapshots
    .map((item) => {
      const date = new Date(item.timestampMs);
      const day = date.getUTCDate();
      const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const year = date.getUTCFullYear();

      let data: number | null;
      if (type === 'Share Price') data = item.sharePrice;
      else if (type === 'NAV') data = item.nav;
      else data = item.apy;

      return {
        day: `${day} ${month} ${year}`,
        data
      };
    })
    .filter((item): item is { day: string; data: number } => item.data !== null);

  const currentPoint = data[data.length - 1];
  const currentValue = currentPoint?.data;

  let domain: [number, number];
  let ticks: Array<number> | undefined;

  const values = data.map((d) => d.data);

  if (type === 'Share Price' && values.length > 0) {
    const maxValue = Math.max(...values);

    // Round up to the next cent; the 4-decimal pre-round keeps float noise
    // (1.07 * 100 === 107.00000000000001) from adding a phantom cent.
    let roundedMax = Math.ceil(Math.round(maxValue * 10000) / 100) / 100;

    // Guarantee visible headroom so the line never rides the top gridline.
    if (roundedMax - maxValue < 0.005) roundedMax = Math.round((roundedMax + 0.01) * 100) / 100;

    domain = [0.99, roundedMax];

    // Generate ticks at 0.01 intervals
    ticks = [];
    for (let tick = 0.99; tick <= roundedMax; tick = Math.round((tick + 0.01) * 100) / 100) {
      ticks.push(tick);
    }
  } else if (values.length > 0) {
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    domain = [Math.max(0, minValue * 0.95), maxValue * 1.05];
  } else {
    domain = [0, 1];
  }

  return {
    data,
    currentValue,
    type,
    domain,
    ticks
  };
};
