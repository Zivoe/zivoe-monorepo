'use client';

// Client module on purpose: react-aria's Focusable inspects its child with React.Children.only,
// which is not safe for an element streamed in from a server component (the dApp renders its
// chip rows from client components too).
import { type ReactNode } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { CHAIN_DISPLAY } from '@zivoe/ui/components/chain-display';
import { Link } from '@zivoe/ui/core/link';
import { Tooltip, TooltipFocusable, TooltipTrigger } from '@zivoe/ui/core/tooltip';

import { APP_URL } from '@/lib/utils';

export function MetricLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" variant="link-primary" size="xs">
      {children}
    </Link>
  );
}

export function AvailableNetworks({ chains }: { chains: Array<CentrifugeChain> }) {
  // Deduped by display family like the dApp's chips: a testnet advertises its mainnet brand.
  const displays = [...new Map(chains.map((chain) => [CHAIN_DISPLAY[chain].label, CHAIN_DISPLAY[chain]])).values()];

  // Sized so ten chips share the row with the label inside a desktop NAV card (288px wide);
  // on tablets (~240px) the chips wrap under it, and gap-y keeps the App link's hover
  // underline (offset 8) clear of them.
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-extraSmall">
      <MetricLink href={APP_URL}>App</MetricLink>
      <span aria-hidden="true" className="text-primary/30">
        |
      </span>
      <span className="text-tiny tracking-wide text-secondary uppercase">Available on</span>
      <div
        role="group"
        aria-label="Available networks"
        className="flex flex-wrap items-center -space-x-1.5 gap-y-1 pl-1"
      >
        {displays.map(({ label, Icon }) => (
          <TooltipTrigger key={label}>
            <TooltipFocusable>
              <span
                role="img"
                aria-label={label}
                className="relative rounded-full ring-2 ring-neutral-0 outline-hidden hover:z-10 focus-visible:z-10 focus-visible:ring-default [&_svg]:size-4.5"
              >
                <Icon aria-hidden="true" />
              </span>
            </TooltipFocusable>
            <Tooltip>{label}</Tooltip>
          </TooltipTrigger>
        ))}
      </div>
    </div>
  );
}
