import { type ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { LIGHTHOUSE_URL } from '@/lib/lighthouse';

import { LighthouseMark } from '@/components/lighthouse-mark';

import { ExperienceIcon } from './experience-icon';
import { LiquidityIcon } from './liquidity-icon';

/**
 * Three cards under the figures: the Lighthouse dashboard, how redemptions
 * work and who runs the vault, each with its one fact and a link out.
 */
export default function DepositHighlights() {
  // A container query rather than viewport breakpoints: this column is
  // narrower beside the Earn box at `lg` (about 456px) than on a tablet just
  // below it, so the cards lay out by their own width. The explicit list role
  // survives the reset list style, which drops it in Safari.
  return (
    <ul role="list" aria-label="Highlights" className="@container flex flex-col gap-3">
      <Highlight
        icon={<LighthouseMark className="size-10" />}
        title="Lighthouse"
        description="Live transparency into vault holdings, NAV, and portfolio composition."
        fact="Live Now"
        factLabel="Dashboard + Reporting"
        href={LIGHTHOUSE_URL}
        action="Open Lighthouse"
        className="bg-element-primary-light"
      />

      <Highlight
        icon={<LiquidityIcon />}
        title="Liquidity"
        description="Weekly redemptions, fulfilled as liquidity allows. View live liquidity by network."
        fact="Weekly"
        factLabel="Redemption schedule"
        href={`${LIGHTHOUSE_URL}/liquidity`}
        action="View Liquidity"
        className="bg-element-tertiary-gentle"
      />

      <Highlight
        icon={<ExperienceIcon />}
        title="Experienced Team"
        description="Over 40 years of combined experience managing credit risk at leading financial institutions."
        fact="40+ Years"
        factLabel="Combined experience"
        href="https://www.zivoe.com/about-us"
        action="Meet the Team"
        className="bg-element-secondary-light"
      />
    </ul>
  );
}

function Highlight({
  icon,
  title,
  description,
  fact,
  factLabel,
  href,
  action,
  className
}: {
  icon: ReactNode;
  title: string;
  description: string;
  fact: string;
  factLabel: string;
  href: string;
  action: string;
  className: string;
}) {
  return (
    <li className={cn('flex flex-col gap-3 rounded-xl p-4 @2xl:flex-row @2xl:items-center @2xl:gap-6', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex w-12 shrink-0 items-center justify-center text-primary [&_svg]:h-8 [&_svg]:w-auto"
        >
          {icon}
        </span>

        <div className="min-w-0">
          <p className="text-regular font-medium text-primary">{title}</p>
          <p className="text-small text-secondary">{description}</p>
        </div>
      </div>

      {/* Stacked: a divided footer row. Side by side: a fixed-width column so the three cards' dividers line up. */}
      <div className="flex items-center justify-between gap-4 border-t border-default pt-3 @2xl:w-84 @2xl:shrink-0 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-6">
        <div className="min-w-0">
          <p className="text-regular font-medium text-primary">{fact}</p>
          <p className="text-extraSmall text-secondary">{factLabel}</p>
        </div>

        <Link variant="border" size="s" href={href} target="_blank" className="shrink-0">
          {action}
          <span className="sr-only">(opens in a new tab)</span>
        </Link>
      </div>
    </li>
  );
}
