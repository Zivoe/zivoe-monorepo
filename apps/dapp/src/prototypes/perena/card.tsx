import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';

import { PERENA_DEMO, PERENA_DEMO_PATH } from './config';
import { DemoArtwork, DemoIdentity } from './identity';

export function PerenaDemoCard() {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-default bg-surface-base shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)] transition-shadow hover:shadow-md">
      <NextLink
        href={PERENA_DEMO_PATH}
        aria-label={`Explore ${PERENA_DEMO.name} demo`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-default focus-visible:outline-hidden focus-visible:ring-inset"
      />
      <DemoArtwork />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <DemoIdentity />
        <p className="text-small text-secondary">Sample data. Try deposits and redemptions with a simulated wallet.</p>
        <div className="mt-auto rounded-xl bg-surface-elevated px-4 py-1">
          {[
            ['Asset type', 'USDC lending'],
            ['Illustrative APY', `${PERENA_DEMO.sampleApy}%`],
            ['Illustrative NAV', `$${PERENA_DEMO.sampleNav.toLocaleString('en-US')}`],
            ['Demo asset', 'USDC'],
            ['Network', 'Solana']
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex min-h-11 items-center justify-between gap-4 border-b border-subtle py-3 last:border-b-0"
            >
              <p className="text-small tracking-wide text-tertiary uppercase">{label}</p>
              <p className="text-regular text-primary">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-regular font-medium text-brand-subtle">
          Explore demo <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
}
