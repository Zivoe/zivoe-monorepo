'use client';

import { type ComponentProps } from 'react';

import { Text } from 'recharts';

import { formatDayTick } from './axis';

/**
 * An X-axis day label. Recharts centers each label under its tick, which
 * clips the edge labels against the plot bounds — align the last one right
 * (and a flush-left first one left) instead. Passing through recharts' own
 * Text keeps the default tick styling.
 */
export function DayTick({
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
