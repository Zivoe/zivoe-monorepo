import { type ComponentType } from 'react';

import { NextLink } from '@zivoe/ui/core/link';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { ArrowRightIcon, EthereumIcon } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { TOKEN_INFO } from '@/components/token-info';

import { type Offering, TARGET_APY_PERCENT, offeringPath } from '@/offerings';

import StreamedAum from './aum';

const NETWORK_ICONS: Record<Offering['networks'][number], ComponentType<IconProps>> = {
  Ethereum: EthereumIcon
};

export default function OfferingCard({ offering }: { offering: Offering }) {
  // Both shadows are ones the rest of the app already uses, and the card rests
  // on the lighter of the two — hover lifts it a step rather than conjuring a
  // shadow out of nothing.
  return (
    <NextLink
      href={offeringPath(offering)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-default bg-surface-base shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)] transition-shadow duration-300 ease-out hover:shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.05),0px_4px_6px_-2px_rgba(16,24,40,0.03)] focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:outline-hidden"
    >
      <div className="h-38" style={{ background: offering.cardGradient }} />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <p className="text-small tracking-wider text-tertiary uppercase">{offering.category}</p>
            <p className="font-heading! text-h6 text-primary">{offering.name}</p>
          </div>

          <p className="text-regular text-secondary">{offering.description}</p>
        </div>

        <div className="mt-auto rounded-xl bg-surface-elevated px-4 py-1">
          <Term label="Issuer" value={offering.issuer} />
          <Term label="Target APY" value={`${TARGET_APY_PERCENT}%`} />
          <Term
            label="AUM"
            value={
              <div className="text-regular text-primary">
                <StreamedAum fallback={<Skeleton className="h-4 w-20 rounded" />} />
              </div>
            }
          />

          {/* The whole card is one anchor, so these name themselves with the
              native title tooltip rather than a focusable tooltip trigger,
              which would nest an interactive element inside the link. role=img
              plus the label gives screen readers the same name. */}
          <Term
            label="Accepted stablecoins"
            value={
              <div className="flex items-center gap-1.5">
                {offering.acceptedAssets.map((asset) => (
                  <span
                    key={asset}
                    role="img"
                    title={TOKEN_INFO[asset].label}
                    aria-label={TOKEN_INFO[asset].label}
                    className="[&_svg]:size-5"
                  >
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
                {offering.networks.map((network) => {
                  const NetworkIcon = NETWORK_ICONS[network];
                  return (
                    <span key={network} role="img" title={network} aria-label={network} className="[&_svg]:size-5">
                      <NetworkIcon />
                    </span>
                  );
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
