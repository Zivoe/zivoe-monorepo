import { type ReactNode } from 'react';

import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';
import { BankIcon, ChartIcon, MoneyIcon, TrendingIcon } from '@zivoe/ui/icons';

import { customNumber } from '@/lib/utils';

import InfoSection from '@/components/info-section';

/** The published Target APY is a target before fees — the number never appears without this. */
const TARGET_APY_DISCLOSURE =
  'Target APY is calculated before fees and expenses. It is a target, not a guaranteed return, and may change. For more information, please see offer terms.';

export default function DepositStats({
  nav,
  sharePrice,
  targetApyPercent
}: {
  nav: number;
  sharePrice: number;
  targetApyPercent: number;
}) {
  return (
    <InfoSection title="Stats" icon={<ChartIcon />}>
      <div className="flex justify-between gap-4">
        <Box title="NAV" icon={<BankIcon />} value={`$${customNumber(nav)}`} />

        <Box title="Target APY" icon={<TrendingIcon />} value={`${targetApyPercent}%`} note={TARGET_APY_DISCLOSURE} />

        <Box title="Token Price" icon={<MoneyIcon />} value={`$${customNumber(sharePrice)}`} />
      </div>
    </InfoSection>
  );
}

function Box({ title, icon, value, note }: { title: string; icon: ReactNode; value: string; note?: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        {/* Scoped to the leading icon so the help trigger keeps its own smaller size. */}
        <span className="[&_svg]:size-5 [&_svg]:text-secondary-contrast">{icon}</span>

        <p className="text-regular whitespace-nowrap text-secondary">{title}</p>

        {note ? (
          <ContextualHelp variant="info" aria-label={`About ${title}`} triggerClassName="-ml-1">
            <ContextualHelpDescription>{note}</ContextualHelpDescription>
          </ContextualHelp>
        ) : null}
      </div>

      <p className="font-heading! text-h6 whitespace-nowrap text-primary xl:text-h5">{value}</p>
    </div>
  );
}
