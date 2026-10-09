import { type ReactNode } from 'react';

/**
 * The page's two columns: the chart and tokens on the left, the links out,
 * the requests and the activity on the right; one column on phones in that
 * order. Shared by the loaded page and its skeleton so they cannot drift apart.
 */
export function PortfolioGrid({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-5 lg:items-start">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">{main}</div>
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">{aside}</div>
    </div>
  );
}
