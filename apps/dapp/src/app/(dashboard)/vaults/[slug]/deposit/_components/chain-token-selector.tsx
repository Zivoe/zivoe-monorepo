'use client';

import { type ReactNode } from 'react';

import * as Aria from 'react-aria-components';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger } from '@zivoe/ui/core/select';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { getTokenInfo } from '@/components/token-info';

import { type TransactionIdentity } from '@/centrifuge';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

/** The token a selector row offers — a deposit asset, or the share token on the redeem tab's chain selector. */
export type ChainSelectorToken = {
  label: string;
  /** Row sublabel (e.g. "USD Coin"); omitted for tokens with no display entry. */
  description?: string;
  icon: ReactNode;
};

/** The display entry for a symbol, or the bare symbol without an icon (test fixtures have no entry). */
export function selectorTokenOf(symbol: string): ChainSelectorToken {
  return getTokenInfo(symbol) ?? { label: symbol, icon: null };
}

/**
 * A Centrifuge vault's row key: chain plus lowercased address. The address
 * alone is not unique across chains (deterministic deployment puts USD1's
 * vault at one address on several), and the deposit picker lists them all.
 */
export function identityRowId(identity: TransactionIdentity): string {
  const { chain, address } = identity.centrifugeVault;
  return `${chain}:${address.toLowerCase()}`;
}

/** "USDC on Ethereum" / "zSMB on Base"-style row label — the selectors' shared vocabulary. */
export function tokenOnChainLabel(token: ChainSelectorToken, chain: CentrifugeChain): string {
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
 * The trigger's identity: `token-on-chain` names the chain under the badged
 * icon; `token` shows the plain icon and symbol where the chain is already
 * settled (the payout coin).
 */
export function ChainTokenTriggerContent({
  token,
  chain,
  variant
}: {
  token: ChainSelectorToken;
  chain: CentrifugeChain;
  variant: 'token-on-chain' | 'token';
}) {
  if (variant === 'token')
    return (
      <span className="flex items-center gap-2 [&_svg]:size-5">
        {token.icon}
        <span className="text-small font-medium text-primary">{token.label}</span>
      </span>
    );

  return (
    <div className="flex items-center gap-2">
      <ChainBadgedTokenIcon chain={chain} icon={token.icon} className="size-5" />

      <div className="flex flex-col items-start">
        <span className="text-small leading-4">{token.label}</span>
        <span className="text-extraSmall leading-none text-secondary">{CHAIN_DISPLAY[chain].label}</span>
      </div>
    </div>
  );
}

/** One selectable "token on chain": a Centrifuge vault, or a chain on the redeem tab's chain selector. */
export type ChainSelectorRow = {
  id: string;
  chain: CentrifugeChain;
  token: ChainSelectorToken;
  /** Optional right-hand detail on the dialog row (e.g. the wallet's balance of the row's token). */
  detail?: ReactNode;
};

/**
 * Rows by the wallet's balance, largest first, whatever the chain. Unknown
 * balances (no wallet, still loading) count as nothing to sort by.
 */
export function sortRowsByBalance<TRow extends ChainSelectorRow>(
  rows: Array<TRow>,
  balanceOf: (row: TRow) => bigint | undefined
): Array<TRow> {
  const known = (row: TRow) => balanceOf(row) ?? 0n;
  const descending = (a: bigint, b: bigint) => (a === b ? 0 : a > b ? -1 : 1);
  // Array.prototype.sort is stable, which is what keeps ties in catalog order.
  return [...rows].sort((a, b) => descending(known(a), known(b)));
}

/** Rows grouped under their chain, in row order. */
export function groupRowsByChain<TRow extends ChainSelectorRow>(
  rows: Array<TRow>
): Array<{ chain: CentrifugeChain; rows: Array<TRow> }> {
  const groups: Array<{ chain: CentrifugeChain; rows: Array<TRow> }> = [];
  for (const row of rows) {
    const group = groups.find((candidate) => candidate.chain === row.chain);
    if (group) group.rows.push(row);
    else groups.push({ chain: row.chain, rows: [row] });
  }
  return groups;
}

/** The dialog row every token selector renders. */
export function TokenSelectorDialogRow({
  row,
  label,
  isSelected,
  onPress
}: {
  row: ChainSelectorRow;
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Aria.Button
      onPress={onPress}
      // Named as the current choice, and drawn apart from a hovered row (both
      // share the elevated fill) by an inset ring.
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        // text-left: a button centres its text, and a label that wraps at 320px would centre its second line.
        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-3 text-left outline-hidden hover:bg-surface-elevated focus:outline-hidden focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-0 focus-visible:outline-hidden',
        isSelected && 'bg-surface-elevated inset-ring-1 inset-ring-default'
      )}
    >
      <ChainBadgedTokenIcon chain={row.chain} icon={row.token.icon} className="size-8 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col items-start">
          <p className="text-regular font-medium text-primary">{label}</p>
          {row.token.description && (
            <p className="hidden text-extraSmall text-secondary sm:block">{row.token.description}</p>
          )}
        </div>

        {row.detail}
      </div>
    </Aria.Button>
  );
}

/**
 * A short "token on chain" list: a Dialog on desktop, a Select on mobile. One
 * row per option, no grouping; the deposit tab's picker, which lists every
 * coin of every chain, is its own component.
 */
export function ChainTokenSelector({
  title,
  rows,
  selectedId,
  onSelect,
  isDisabled,
  trigger = 'token-on-chain'
}: {
  title: string;
  rows: Array<ChainSelectorRow>;
  selectedId: string;
  onSelect: (id: string) => void;
  isDisabled: boolean;
  /** What the closed control shows — see ChainTokenTriggerContent. */
  trigger?: 'token-on-chain' | 'token';
}) {
  // Always present: the flows derive `selectedId` from the rows' own identities.
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  if (!selected) throw new Error('ChainTokenSelector needs at least one row.');

  // The payout coin's rows all sit on one chain, so they need no chain name.
  const rowLabel = (row: ChainSelectorRow) =>
    trigger === 'token' ? row.token.label : tokenOnChainLabel(row.token, row.chain);
  const triggerClassName = trigger === 'token' ? 'h-auto gap-2 py-1' : 'h-auto w-34 justify-between gap-2 py-1';

  return (
    <>
      {/* Desktop: a dialog with one row per option. */}
      <Dialog>
        <SelectTrigger
          variant="border-light"
          // Named like the mobile Select below: the content alone reads "zSMB Ethereum".
          aria-label={`${title}, currently ${rowLabel(selected)}`}
          className={cn('hidden lg:flex', triggerClassName)}
          isDisabled={isDisabled}
        >
          <ChainTokenTriggerContent token={selected.token} chain={selected.chain} variant={trigger} />
        </SelectTrigger>

        <DialogContent dialogClassName="gap-0" showCloseButton={false}>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>

              <DialogContentBox className="gap-1 p-4">
                {rows.map((row) => (
                  <TokenSelectorDialogRow
                    key={row.id}
                    row={row}
                    label={rowLabel(row)}
                    isSelected={row.id === selected.id}
                    onPress={() => {
                      onSelect(row.id);
                      close();
                    }}
                  />
                ))}
              </DialogContentBox>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile: the compact Select over the same rows. Named with the current
          selection: the trigger renders no SelectValue, so the label alone
          would be the whole accessible name. */}
      <Select
        placeholder="Select"
        aria-label={`${title}: ${rowLabel(selected)}`}
        selectedKey={selected.id}
        onSelectionChange={(key) => {
          const row = rows.find((candidate) => candidate.id === key);
          if (row) onSelect(row.id);
        }}
        isDisabled={isDisabled}
      >
        <SelectTrigger variant="border-light" className={cn('lg:hidden', triggerClassName)}>
          <ChainTokenTriggerContent token={selected.token} chain={selected.chain} variant={trigger} />
        </SelectTrigger>

        <SelectPopover>
          <SelectListBox items={rows} className="min-h-0">
            {(row) => (
              <SelectItem
                key={row.id}
                id={row.id}
                textValue={rowLabel(row)}
                className="flex items-center gap-2"
                showCheckmark={false}
              >
                <ChainBadgedTokenIcon chain={row.chain} icon={row.token.icon} className="size-5" />
                {rowLabel(row)}
              </SelectItem>
            )}
          </SelectListBox>
        </SelectPopover>
      </Select>
    </>
  );
}
