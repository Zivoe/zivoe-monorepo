import { type ComponentType } from 'react';

import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon, EthereumIcon } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { customNumber } from '@/lib/utils';

import { TOKEN_INFO } from '@/components/token-info';

import { type Opportunity, opportunityPath } from '@/opportunities';

const NETWORK_ICONS: Record<Opportunity['networks'][number], ComponentType<IconProps>> = {
  Ethereum: EthereumIcon
};

export default function OpportunityCard({
  opportunity,
  apy,
  aum
}: {
  opportunity: Opportunity;
  /** 30-day Trailing APY in percent; null until 30 days of history exist. */
  apy: number | null;
  /** Share-class NAV in USD; null when the indexer read failed. */
  aum: number | null;
}) {
  // Both shadows are ones the rest of the app already uses, and the card rests
  // on the lighter of the two — hover lifts it a step rather than conjuring a
  // shadow out of nothing.
  return (
    <NextLink
      href={opportunityPath(opportunity)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-default bg-surface-base shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)] transition-shadow duration-300 ease-out hover:shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.05),0px_4px_6px_-2px_rgba(16,24,40,0.03)] focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:outline-hidden"
    >
      <div className="h-38" style={{ background: opportunity.cardGradient }} />

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-small tracking-wider text-tertiary uppercase">{opportunity.category}</p>
          <p className="font-heading! text-h6 text-primary">{opportunity.name}</p>
          <p className="text-regular text-secondary">{opportunity.description}</p>
        </div>

        <div className="mt-auto rounded-xl bg-surface-elevated px-4">
          <Term label="Issuer" value={opportunity.issuer} />
          <Term label="APY" value={apy !== null ? `${customNumber(apy)}%` : '—'} />
          <Term label="AUM" value={aum !== null ? `$${customNumber(aum)}` : '—'} />

          <Term
            label="Accepted stablecoins"
            value={
              <div className="flex items-center gap-1.5">
                {opportunity.acceptedAssets.map((asset) => (
                  <span key={asset} className="[&_svg]:size-5">
                    {TOKEN_INFO[asset].icon}
                  </span>
                ))}
              </div>
            }
          />

          <Term
            label="Available on"
            value={
              <div className="flex items-center gap-1.5">
                {opportunity.networks.map((network) => {
                  const NetworkIcon = NETWORK_ICONS[network];
                  return <NetworkIcon key={network} className="size-5" aria-label={network} />;
                })}
              </div>
            }
          />
        </div>

        <div className="flex items-center justify-end gap-1.5 text-regular font-medium text-brand-subtle">
          Invest now
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </NextLink>
  );
}

function Term({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-subtle py-3 last:border-b-0">
      <p className="text-small tracking-wide text-tertiary uppercase">{label}</p>
      {typeof value === 'string' ? <p className="text-regular text-primary">{value}</p> : value}
    </div>
  );
}
