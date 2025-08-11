'use client';

import { useState } from 'react';

import { Key } from 'react-aria-components';
import { useMediaQuery } from 'react-responsive';
import { AreaChart, CartesianGrid, Area as ReArea, XAxis, YAxis } from 'recharts';
import { formatEther } from 'viem';

import type { Network } from '@zivoe/contracts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { ChartIcon } from '@zivoe/ui/icons';

import { DepositDailyData } from '@/server/data';

import { customNumber } from '@/lib/utils';

import { useIsMobile } from '@/hooks/useIsMobile';

import { env } from '@/env';

const CHART_TYPES = ['Index price', 'TVL', 'APY'] as const;
type ChartType = (typeof CHART_TYPES)[number];

const CHART_SELECT_ITEMS = CHART_TYPES.map((type, index) => ({ id: index, label: type }));

export default function DepositCharts({ dailyData }: { dailyData: Array<DepositDailyData> }) {
  const isMobile = useIsMobile();

  const [selectedChartType, setSelectedChartType] = useState<Key>(0);

  const chart = parseChartData({ dailyData, typeIndex: selectedChartType });
  if (!chart) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-between gap-2">
        {chart.currentValue && (
          <p className="text-h4 text-primary">
            {chart.type !== 'APY' && '$'}
            {customNumber(chart.currentValue, chart.type === 'Index price' ? 3 : 2)}
            {chart.type === 'APY' && '%'}
          </p>
        )}

        <Select
          placeholder="Select"
          aria-label="Select a chart view"
          selectedKey={selectedChartType}
          onSelectionChange={(key) => setSelectedChartType(key ?? 0)}
        >
          <SelectTrigger>
            <ChartIcon className="size-4 text-icon-default" />
            <SelectValue />
          </SelectTrigger>

          <SelectPopover>
            <SelectListBox items={CHART_SELECT_ITEMS}>
              {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
            </SelectListBox>
          </SelectPopover>
        </Select>
      </div>

      <div className="w-full">
        <ChartContainer config={{}}>
          <AreaChart accessibilityLayer data={chart.data} margin={{ left: 10, right: 0, top: 0, bottom: 0 }}>
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
              tickMargin={16}
              scale="linear"
              domain={DOMAINS[env.NEXT_PUBLIC_NETWORK][chart.type]}
              tickFormatter={(value) => (chart.type === 'TVL' || chart.type === 'APY' ? customNumber(value) : value)}
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  hideLabel
                  formatter={(value, _, item) => {
                    const data = value;
                    const date = item.payload.day;

                    return (
                      <div className="flex flex-col gap-1">
                        <span className="font-heading text-regular tabular-nums text-primary">
                          {chart.type !== 'APY' && '$'}
                          {customNumber(Number(data), chart.type === 'Index price' ? 3 : 2)}
                          {chart.type === 'APY' && '%'}
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

const DOMAINS: Record<Network, Record<ChartType, [number, number]>> = {
  MAINNET: {
    'Index price': [0.99, 1.02],
    TVL: [5_000_000, 10_000_000],
    APY: [10, 35]
  },
  SEPOLIA: {
    'Index price': [0, 2_000],
    TVL: [70_000_000, 100_000_000],
    APY: [16, 24]
  }
};

const parseChartData = ({ dailyData, typeIndex }: { dailyData: Array<DepositDailyData>; typeIndex: Key }) => {
  const type = CHART_TYPES[Number(typeIndex)];
  if (!type) return undefined;

  const data = dailyData.map((item) => {
    const date = new Date(item.timestamp);
    const day = date.getUTCDate();
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = date.getUTCFullYear();

    let data: number | undefined;
    if (type === 'Index price') data = item.indexPrice;
    else if (type === 'TVL') data = Number(formatEther(BigInt(item.tvl)));
    else data = item.apy;

    return {
      day: `${day} ${month} ${year}`,
      data
    };
  });

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return undefined;

  let currentValue: number | undefined;
  if (type === 'Index price') currentValue = currentDailyData.indexPrice;
  else if (type === 'TVL') currentValue = Number(formatEther(BigInt(currentDailyData.tvl)));
  else currentValue = currentDailyData.apy;

  return {
    data,
    currentValue,
    type
  };
};
