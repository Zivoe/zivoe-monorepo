'use client';

import { useState } from 'react';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { cn } from '@zivoe/ui/lib/tw-utils';

import { CurrentDailyData } from '@/server/data';

import { formatBigIntToReadable } from '@/lib/utils';

const CATEGORIES: Array<{ key: Exclude<keyof CurrentDailyData['tvl'], 'total'>; label: string; color: string }> = [
  { key: 'stablecoins', label: 'Stablecoins', color: 'hsl(var(--primary-800))' },
  { key: 'treasuryBills', label: 'Treasury Bills', color: 'hsl(var(--primary-600))' },
  { key: 'deFi', label: 'DeFi Positions', color: 'hsl(var(--primary-400))' },
  { key: 'loans', label: 'Loans', color: 'hsl(var(--primary-500))' }
];

export default function AUMDonutChart({ data, className }: { data: CurrentDailyData['tvl']; className?: string }) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const chartData = [...CATEGORIES]
    .sort((a, b) => data[b.key].percentage - data[a.key].percentage)
    .map(({ key, label, color }) => {
      const dailyData = data[key];

      return {
        label,
        total: formatBigIntToReadable(dailyData.total, 18),
        percentage: dailyData.percentage,
        color
      };
    })
    .filter((item) => item.percentage > 0);

  const activeSegment = activeIndex >= 0 && activeIndex < chartData.length ? chartData[activeIndex] : null;

  const handlePieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const handlePieLeave = () => {
    setActiveIndex(-1);
  };

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative size-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="percentage"
              nameKey="percentage"
              cx="50%"
              cy="50%"
              innerRadius={90}
              outerRadius={140}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              onMouseEnter={handlePieEnter}
              onMouseLeave={handlePieLeave}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  fillOpacity={activeIndex === -1 ? 1 : activeIndex === index ? 1 : 0.3}
                  className="cursor-pointer"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-regular text-tertiary">{activeSegment ? activeSegment.label : 'Total AUM'}</p>
          <p className="text-h6 text-primary">
            ${activeSegment ? activeSegment.total : formatBigIntToReadable(data.total, 18)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AUMDonutChartSkeleton() {
  return (
    <div className="relative size-[300px]">
      <svg width="300" height="300" viewBox="0 0 300 300">
        <g transform="translate(150, 150)">
          <circle
            cx="0"
            cy="0"
            r="115"
            fill="none"
            stroke="hsl(var(--neutral-200))"
            strokeWidth="50"
            className="animate-[pulse_1.5s_ease-in-out_infinite] opacity-60"
          />
        </g>
      </svg>
    </div>
  );
}
