'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';

import { Liquidity } from '@/server/data';

import { customNumber, formatBigIntWithCommas } from '@/lib/utils';

export default function LiquidityChart({ data }: { data: Liquidity }) {
  const chartData = (() => {
    const instantValue = Number(data.aUSDC / 10n ** 18n) + Number(data.uniswap / 10n ** 6n);
    const days3Value = Number(data.days3 / 10n ** 12n) / 10 ** 6;
    const days30Value = Number(data.days30 / 10n ** 12n) / 10 ** 6;

    const aUSDCIn6Decimals = data.aUSDC / 10n ** 12n;
    const instantOriginalValue = aUSDCIn6Decimals + data.uniswap;

    return [
      {
        timeframe: 'Instant',
        value: instantValue,
        fill: '#009B9B',
        originalValue: instantOriginalValue,
        decimals: 6
      },
      {
        timeframe: 't + 3 days',
        value: days3Value,
        fill: '#13595C',
        originalValue: data.days3,
        decimals: 18
      },
      {
        timeframe: 't + 30 Days',
        value: days30Value,
        fill: '#10393B',
        originalValue: data.days30,
        decimals: 18
      }
    ];
  })();

  const formatYAxisTick = (value: number) => {
    return `$${customNumber(value, 0)}`;
  };

  const yAxisDomain = (() => {
    const padding = Math.max(...chartData.map((d) => d.value)) * 0.1;
    return [0, Math.ceil((Math.max(...chartData.map((d) => d.value)) + padding) / 10000) * 10000];
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-leading text-primary">Time To Liquidity</h3>
        <p className="text-regular text-secondary">
          Displays how much liquidity is available categorized by how long it takes to redeem
        </p>
      </div>

      <div className="h-full w-full">
        <ChartContainer
          config={{}}
          className="h-[320px] w-full [&>div]:!aspect-auto [&>div]:h-full [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-primary-100"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              top: 20,
              right: 0,
              bottom: 20,
              left: 10
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="0" className="stroke-neutral-200" />

            <XAxis dataKey="timeframe" tickLine={false} axisLine={false} dy={10} />

            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxisTick}
              domain={yAxisDomain}
              dx={-5}
              width={40}
            />

            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(_value, _name, item) => {
                    const dataPoint = item.payload;
                    const formattedValue = formatBigIntWithCommas({
                      value: dataPoint.originalValue,
                      tokenDecimals: dataPoint.decimals,
                      displayDecimals: 2
                    });

                    return (
                      <div className="flex flex-col gap-1">
                        <span className="text-extraSmall font-medium text-secondary">{dataPoint.timeframe}</span>
                        <span className="font-heading text-regular text-primary">${formattedValue}</span>
                      </div>
                    );
                  }}
                />
              }
            />

            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={100} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
