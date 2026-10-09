'use client';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';

import { type TokenHolding } from '@/portfolio';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { AmountBlock } from './amount-block';

/** The networks one coin sits on, opened from its row: only the networks holding something. */
const MAX_LOGOS = 6;

export function TokenNetworksDialog({ token }: { token: TokenHolding }) {
  const count = token.networks.length;
  // Six logos keep the button narrower than a phone's column; the rest become a count.
  const shown = token.networks.slice(0, MAX_LOGOS);
  const hidden = count - shown.length;

  return (
    <Dialog>
      <Button
        variant="link-primary"
        size="xs"
        // The link's hover underline is kept to the words: propagated to the whole button it also ran under the "+N" count.
        className="group gap-2 px-0 hover:no-underline"
        aria-label={`${count} ${count === 1 ? 'network' : 'networks'}: ${token.networks.map(({ chain }) => CHAIN_DISPLAY[chain].label).join(', ')}`}
      >
        {/* Plain logos: a button cannot hold focusable children, and the label names every network. */}
        <span aria-hidden="true" className="flex items-center -space-x-1 [&_svg]:size-5">
          {shown.map(({ chain }) => {
            const { Icon } = CHAIN_DISPLAY[chain];
            return <Icon key={chain} className="rounded-full ring-2 ring-neutral-0" />;
          })}
          {hidden > 0 && (
            <span className="inline-grid size-5 place-items-center rounded-full bg-element-neutral text-[0.625rem] font-medium text-secondary ring-2 ring-neutral-0">
              +{hidden}
            </span>
          )}
        </span>
        <span className="underline-offset-8 group-hover:underline">
          {count} {count === 1 ? 'network' : 'networks'}
        </span>
      </Button>

      <DialogContent dialogClassName="gap-0">
        <DialogHeader>
          <DialogTitle>{token.symbol} by network</DialogTitle>
        </DialogHeader>

        <DialogContentBox className="gap-0 py-2">
          <ul className="flex flex-col">
            {token.networks.map((network) => {
              const { label, Icon } = CHAIN_DISPLAY[network.chain];
              return (
                <li
                  key={network.chain}
                  className="flex items-start justify-between gap-4 border-b border-subtle py-4 last:border-b-0"
                >
                  <p className="flex items-center gap-2 text-regular text-primary">
                    <Icon className="size-5 rounded-full" />
                    {label}
                  </p>
                  <AmountBlock amounts={network} symbol={token.symbol} valueD18={network.valueD18} />
                </li>
              );
            })}
          </ul>
        </DialogContentBox>
      </DialogContent>
    </Dialog>
  );
}
