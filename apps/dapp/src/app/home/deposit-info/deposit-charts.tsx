'use client';

import { useState } from 'react';

import { Key } from 'react-aria-components';
import { AreaChart, CartesianGrid, Area as ReArea, XAxis, YAxis } from 'recharts';
import { formatEther } from 'viem';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { ChartIcon } from '@zivoe/ui/icons';

import { DepositDailyData } from '@/server/data';

import { customNumber } from '@/lib/utils';

import { useIsMobile } from '@/hooks/useIsMobile';

const CHART_TYPES = ['Index price', 'TVL'] as const;

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
            ${customNumber(chart.currentValue, chart.type === 'Index price' ? 3 : 2)}
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
              tickFormatter={(value) => (chart.type === 'TVL' ? customNumber(value) : value)}
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
                          ${customNumber(Number(data), chart.type === 'Index price' ? 3 : 2)}
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
    else if (type === 'TVL') data = Number(formatEther(BigInt(item.tvl.total)));
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
  else if (type === 'TVL') currentValue = Number(formatEther(BigInt(currentDailyData.tvl.total)));
  else currentValue = currentDailyData.apy;

  let domain: [number, number];
  let ticks: number[] | undefined;

  if (type === 'TVL') {
    domain = [5_000_000, 10_000_000];
  } else {
    const values = data.map((d) => d.data).filter((d) => d !== undefined);
    const maxValue = Math.max(...values);

    // Round up to nearest 0.01
    const roundedMax = Math.ceil(maxValue * 100) / 100;
    domain = [0.99, roundedMax];

    // Generate ticks at 0.01 intervals
    ticks = [];
    for (let tick = 0.99; tick <= roundedMax; tick = Math.round((tick + 0.01) * 100) / 100) {
      ticks.push(tick);
    }
  }

  return {
    data,
    currentValue,
    type,
    domain,
    ticks
  };
};
