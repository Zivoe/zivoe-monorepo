'use client';

import { type ComponentProps, useState } from 'react';

import { type Key } from 'react-aria-components';
import { AreaChart, CartesianGrid, Area as ReArea, Text, XAxis, YAxis } from 'recharts';

import { type ShareStatsPayload, getUtcDayStartSeconds } from '@zivoe/centrifuge-indexer';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { ChartIcon } from '@zivoe/ui/icons';

import { type CentrifugeDailySnapshot } from '@/server/data/centrifuge-metrics';

import { customNumber } from '@/lib/utils';

import { useIsMobile } from '@/hooks/useIsMobile';

import { CHART_TYPES, formatChartValue, formatDayTick, parseChartData } from './deposit-charts-data';

const CHART_SELECT_ITEMS = CHART_TYPES.map((type, index) => ({ id: index, label: type }));

// Recharts centers each label under its tick, which clips the edge labels
// against the plot bounds — align the last one right (and a flush-left first
// one left) instead. Passing through recharts' own Text keeps the default
// tick styling.
function DayTick({
  index,
  visibleTicksCount,
  payload,
  ...textProps
}: {
  index?: number;
  visibleTicksCount?: number;
  payload?: { value: number };
} & Omit<ComponentProps<typeof Text>, 'children'>) {
  const isLast = index === (visibleTicksCount ?? 0) - 1;
  const isFlushLeft = index === 0 && Number(textProps.x ?? 0) <= 20;

  return (
    <Text {...textProps} textAnchor={isLast ? 'end' : isFlushLeft ? 'start' : 'middle'}>
      {payload === undefined ? '' : formatDayTick(payload.value)}
    </Text>
  );
}

export default function DepositCharts({
  snapshots,
  current
}: {
  snapshots: Array<CentrifugeDailySnapshot>;
  current: ShareStatsPayload | null;
}) {
  const isMobile = useIsMobile();

  const [selectedChartType, setSelectedChartType] = useState<Key>(0);

  const chart = parseChartData({
    snapshots,
    current,
    typeIndex: selectedChartType,
    todayStartMs: getUtcDayStartSeconds(Date.now()) * 1000
  });
  if (!chart) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-between gap-2">
        {chart.headline !== undefined && <p className="text-h4 text-primary">{chart.headline}</p>}

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

            {/* A numeric time axis with precomputed evenly-strided day ticks —
                a category axis lets recharts drop colliding labels ad hoc,
                which leaves uneven gaps in the label row. */}
            <XAxis
              dataKey="ts"
              type="number"
              scale="linear"
              domain={['dataMin', 'dataMax']}
              ticks={chart.xTicks}
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={DayTick}
            />

            {/* Axis ticks intentionally keep the compact form — k/M for NAV,
                step-matched fixed decimals for Token Price — while the
                headline and tooltip show the full formatted values. */}
            <YAxis
              tickLine={false}
              hide={isMobile}
              axisLine={false}
              minTickGap={20}
              width={60}
              scale="linear"
              domain={chart.domain}
              ticks={chart.ticks}
              tickFormatter={(value: number) =>
                chart.type === 'NAV' ? customNumber(value) : value.toFixed(chart.tickDecimals)
              }
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
                        <span className="font-heading! text-regular text-primary tabular-nums">
                          {formatChartValue({ value: Number(value), type: chart.type })}
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
