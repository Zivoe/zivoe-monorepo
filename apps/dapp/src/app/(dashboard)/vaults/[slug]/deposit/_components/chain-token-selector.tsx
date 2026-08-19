'use client';

import { type ReactNode } from 'react';

import * as Aria from 'react-aria-components';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger } from '@zivoe/ui/core/select';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

/** The token whose chain instances the selector offers — USDC on the deposit tab, the share token on redeem. */
export type ChainSelectorToken = {
  label: string;
  /** Row sublabel (e.g. "US Dollar Coin"); omitted for tokens with no display entry. */
  description?: string;
  icon: ReactNode;
};

/** "USDC on Ethereum" / "zSMB on Base"-style row label — the selector's vocabulary on both tabs. */
function tokenOnChainLabel(token: ChainSelectorToken, chain: CentrifugeChain): string {
  return `${token.label} on ${CHAIN_DISPLAY[chain].label}`;
}

/**
 * The token's icon carrying the chain's badge — one glyph saying "this token,
 * on that chain". Explicitly sized via className (e.g. size-8); the badge
 * scales with it. The token icon is force-fitted inside its own wrapper so
 * neither it nor the badge can be blown up by ancestors' `[&_svg]:size-*`
 * styling.
 */
export function ChainBadgedTokenIcon({
  chain,
  icon,
  className
}: {
  chain: CentrifugeChain;
  icon: ReactNode;
  className?: string;
}) {
  const ChainIcon = CHAIN_DISPLAY[chain].Icon;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span className="size-full [&_svg]:!size-full">{icon}</span>
      <ChainIcon className="absolute -right-0.5 -bottom-0.5 !size-[55%] rounded-full ring-2 ring-neutral-0" />
    </span>
  );
}

/**
 * The trigger's identity: the chain-badged token icon, the token's symbol, and
 * the chain it transacts on underneath — so the selected network is readable
 * without opening the selector.
 */
function ChainTokenTriggerContent({ token, chain }: { token: ChainSelectorToken; chain: CentrifugeChain }) {
  return (
    <div className="flex items-center gap-2">
      <ChainBadgedTokenIcon chain={chain} icon={token.icon} className="size-5" />

      <div className="flex flex-col items-start">
        <span className="text-small leading-4">{token.label}</span>
        <span className="text-extraSmall leading-none text-tertiary">{CHAIN_DISPLAY[chain].label}</span>
      </div>
    </div>
  );
}

export type ChainSelectorRow = {
  chain: CentrifugeChain;
  /** Optional right-hand detail on the dialog row (e.g. the chain's balance). */
  detail?: ReactNode;
};

/**
 * The chain dimension of one token's selector: a Dialog on desktop, a Select
 * on mobile. Selecting "<token> on <chain>" is selecting the chain the flow
 * transacts on.
 */
export function ChainTokenSelector({
  title,
  token,
  rows,
  selectedChain,
  onSelect,
  isDisabled
}: {
  title: string;
  token: ChainSelectorToken;
  rows: Array<ChainSelectorRow>;
  selectedChain: CentrifugeChain;
  onSelect: (chain: CentrifugeChain) => void;
  isDisabled: boolean;
}) {
  return (
    <>
      {/* Desktop: a dialog with one row per chain, mirroring the Select Asset pattern. */}
      <Dialog>
        <SelectTrigger
          variant="border-light"
          className="hidden h-auto w-34 justify-between gap-2 py-1 lg:flex"
          isDisabled={isDisabled}
        >
          <ChainTokenTriggerContent token={token} chain={selectedChain} />
        </SelectTrigger>

        <DialogContent dialogClassName="gap-0" showCloseButton={false}>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>

              <DialogContentBox className="gap-2 p-4">
                {rows.map((row) => (
                  <Aria.Button
                    key={row.chain}
                    onPress={() => {
                      onSelect(row.chain);
                      close();
                    }}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-3 outline-hidden hover:bg-surface-elevated focus:outline-hidden focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-0 focus-visible:outline-hidden',
                      row.chain === selectedChain && 'bg-surface-elevated'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <ChainBadgedTokenIcon chain={row.chain} icon={token.icon} className="size-8" />

                      <div className="flex flex-col items-start">
                        <p className="text-regular font-medium text-primary">{tokenOnChainLabel(token, row.chain)}</p>
                        {token.description && <p className="text-extraSmall text-tertiary">{token.description}</p>}
                      </div>
                    </div>

                    {row.detail}
                  </Aria.Button>
                ))}
              </DialogContentBox>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile: the compact Select over the same rows. */}
      <Select
        placeholder="Select"
        aria-label={title}
        selectedKey={selectedChain}
        onSelectionChange={(key) => {
          const row = rows.find((candidate) => candidate.chain === key);
          if (row) onSelect(row.chain);
        }}
        isDisabled={isDisabled}
      >
        <SelectTrigger variant="border-light" className="h-auto w-34 justify-between gap-2 py-1 lg:hidden">
          <ChainTokenTriggerContent token={token} chain={selectedChain} />
        </SelectTrigger>

        <SelectPopover>
          <SelectListBox items={rows.map((row) => ({ id: row.chain, ...row }))}>
            {(item) => (
              <SelectItem
                key={item.id}
                value={item}
                textValue={tokenOnChainLabel(token, item.chain)}
                className="flex items-center gap-2"
                showCheckmark={false}
              >
                <ChainBadgedTokenIcon chain={item.chain} icon={token.icon} className="size-5" />
                {tokenOnChainLabel(token, item.chain)}
              </SelectItem>
            )}
          </SelectListBox>
        </SelectPopover>
      </Select>
    </>
  );
}
