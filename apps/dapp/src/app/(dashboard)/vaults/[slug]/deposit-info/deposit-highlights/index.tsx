import { type ReactNode } from 'react';

import { ExternalLinkIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { ExperienceIcon } from './experience-icon';
import { LighthouseIcon } from './lighthouse-icon';
import { LiquidityIcon } from './liquidity-icon';

export default function DepositHighlights() {
  return (
    <section aria-label="Vault highlights" className="@container flex flex-col gap-2">
      <Card
        icon={<LighthouseIcon />}
        title="Lighthouse"
        description="Live transparency into vault holdings, NAV, and portfolio composition."
        detail="Live Now"
        detailLabel="Dashboard + Reporting"
        href="https://lighthouse.zivoe.com/"
        action="Open Lighthouse"
        className="bg-element-primary-gentle text-primary-600"
      />

      <Card
        icon={<LiquidityIcon />}
        title="Liquidity"
        description="Weekly redemptions, fulfilled as liquidity allows. View live liquidity by network."
        detail="Weekly"
        detailLabel="Redemption schedule"
        href="https://lighthouse.zivoe.com/liquidity"
        action="View Liquidity"
        className="bg-tertiary-100 text-[#2563eb]"
      />

      <Card
        icon={<ExperienceIcon />}
        title="Experienced Team"
        description="Over 40 years of combined experience managing credit risk at leading financial institutions."
        detail="40+ Years"
        detailLabel="Combined experience"
        href="https://www.zivoe.com/about-us"
        action="Meet the Team"
        className="bg-[#f4f3ff] text-[#4f46e5]"
      />
    </section>
  );
}

function Card({
  icon,
  title,
  description,
  detail,
  detailLabel,
  href,
  action,
  className
}: {
  icon: ReactNode;
  title: string;
  description: string;
  detail: string;
  detailLabel: string;
  href: string;
  action: string;
  className: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-lg p-3 @min-[42rem]:grid @min-[42rem]:grid-cols-[minmax(0,1fr)_9.5rem_9rem] @min-[42rem]:items-center @min-[42rem]:gap-4 @min-[42rem]:p-3.5',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 @min-[42rem]:gap-3.5">
        <span
          aria-hidden="true"
          className="flex w-8 shrink-0 items-center justify-center @min-[42rem]:w-10 [&_svg]:h-8 [&_svg]:w-8 @min-[42rem]:[&_svg]:h-10 @min-[42rem]:[&_svg]:w-10"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-small leading-5 font-medium text-primary">{title}</h3>
          <p className="mt-0.5 text-extraSmall text-secondary @min-[42rem]:text-[0.8125rem] @min-[42rem]:leading-[1.125rem]">
            {description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-current/10 pt-2.5 @min-[42rem]:contents">
        <div className="min-w-0 @min-[42rem]:border-l @min-[42rem]:border-current/15 @min-[42rem]:pl-5">
          <p className="text-regular leading-5 font-semibold @min-[42rem]:text-leading @min-[42rem]:leading-6">
            {detail}
          </p>
          <p className="mt-0.5 text-extraSmall text-secondary @min-[42rem]:text-[0.8125rem] @min-[42rem]:leading-[1.125rem]">
            {detailLabel}
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-current bg-surface-base/80 px-2.5 py-2 text-extraSmall font-medium whitespace-nowrap transition-colors hover:bg-surface-base focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current @min-[42rem]:min-h-10 @min-[42rem]:w-full @min-[42rem]:gap-2 @min-[42rem]:px-3 @min-[42rem]:text-[0.8125rem] @min-[42rem]:leading-5"
        >
          {action}
          <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}
