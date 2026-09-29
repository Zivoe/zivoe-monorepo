'use client';

import { useId, useState } from 'react';

import { useMediaQuery } from 'react-responsive';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@zivoe/ui/core/chart';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { ChartIcon } from '@zivoe/ui/icons';

import { PERENA_DEMO } from './config';

const SAMPLE_DATA = [220_000, 226_000, 225_000, 236_000, 241_000, PERENA_DEMO.sampleNav].map((nav, index) => ({
  month: `Month ${index + 1}`,
  nav,
  price: 1
}));
const VIEWS = [
  { id: 'nav', label: 'NAV' },
  { id: 'price', label: 'Token Price' }
];

export function SampleChart() {
  const [view, setView] = useState('nav');
  const isMobile = useMediaQuery({ query: '(max-width: 599px)' });
  const gradientId = useId().replace(/:/g, '');
  const isNav = view === 'nav';

  return (
    <figure
      className="flex w-full min-w-0 flex-col gap-4"
      aria-label={isNav ? 'Illustrative NAV chart' : 'Demo token price chart'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-h4 text-primary">{isNav ? '$250,000' : '$1.00'}</p>
          <p className="mt-1 text-small text-tertiary">
            Sample data · {isNav ? 'Illustrative NAV' : 'Fixed demo price'}
          </p>
        </div>
        <Select aria-label="Select a chart view" value={view} onChange={(key) => setView(String(key ?? 'nav'))}>
          <SelectTrigger>
            <ChartIcon className="size-4 text-icon-default" />
            <SelectValue />
          </SelectTrigger>
          <SelectPopover>
            <SelectListBox items={VIEWS}>
              {(item) => (
                <SelectItem id={item.id} showCheckmark={false}>
                  {item.label}
                </SelectItem>
              )}
            </SelectListBox>
          </SelectPopover>
        </Select>
      </div>
      <ChartContainer config={{}}>
        <AreaChart accessibilityLayer data={SAMPLE_DATA} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            interval={0}
            ticks={isMobile ? ['Month 1', 'Month 3', 'Month 6'] : undefined}
            padding={{ left: isMobile ? 24 : 0 }}
            minTickGap={0}
          />
          <YAxis
            hide={isMobile}
            tickLine={false}
            axisLine={false}
            width={60}
            domain={isNav ? [220_000, 250_000] : [0.98, 1.02]}
            ticks={isNav ? [220_000, 230_000, 240_000, 250_000] : [0.98, 0.99, 1, 1.01, 1.02]}
            tickFormatter={(value: number) => (isNav ? `${value / 1000}k` : value.toFixed(2))}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, _, item) => (
                  <div className="flex flex-col gap-1">
                    <span className="font-heading! text-regular text-primary tabular-nums">
                      ${Number(value).toLocaleString('en-US', { minimumFractionDigits: isNav ? 0 : 2 })}
                    </span>
                    <span className="text-small text-secondary">{item.payload.month} · Sample data</span>
                  </div>
                )}
              />
            }
          />
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="39.55%" stopColor="hsl(var(--primary-600))" stopOpacity={0.1} />
              <stop offset="100%" stopColor="hsl(var(--primary-600))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            dataKey={view}
            type="linear"
            fill={`url(#${gradientId})`}
            stroke="hsl(var(--primary-600))"
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      <figcaption className="text-small text-tertiary">
        {isNav
          ? 'Illustrative 6-month NAV ending at $250,000. Not live or historical performance.'
          : 'Sample token price fixed at $1.00 for all 6 months. No yield accrues in the demo.'}{' '}
        Demo transactions do not change this chart.
      </figcaption>
    </figure>
  );
}
