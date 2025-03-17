import { Meta, StoryObj } from '@storybook/react';
import { AreaChart, CartesianGrid, Area as ReArea, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from './chart';

const meta: Meta = {
  title: 'Core/Chart'
};

export default meta;
type Story = StoryObj;

const chartData = [
  { day: '1 Mar 2025', price: 1 },
  { day: '2 Mar 2025', price: 1.01 },
  { day: '3 Mar 2025', price: 1.01 },
  { day: '4 Mar 2025', price: 1.01 },
  { day: '5 Mar 2025', price: 1.02 },
  { day: '6 Mar 2025', price: 1.03 }
];

export const Area: Story = {
  render: () => (
    <div className="min-h-[240px] max-w-[770px]">
      <ChartContainer config={{}}>
        <AreaChart accessibilityLayer data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 20 }}>
          <CartesianGrid vertical={false} />

          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={20}
            tickFormatter={(value) => {
              return value.replace(/\s\d{4}$/, '');
            }}
          />

          <YAxis tickLine={false} axisLine={false} tickMargin={16} scale="linear" domain={[0.97, 1.03]} />

          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                hideLabel
                formatter={(value, _, item) => {
                  const price = value;
                  const date = item.payload.day;

                  return (
                    <div className="flex flex-col gap-1">
                      <span className="font-heading text-regular tabular-nums text-primary">
                        ${price.toLocaleString()}
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

          <ReArea dataKey="price" type="linear" fill="url(#fillPrice)" stroke="hsl(var(--primary-600))" />
        </AreaChart>
      </ChartContainer>
    </div>
  )
};
