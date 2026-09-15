'use client';

import { useId, useState } from 'react';

import * as Aria from 'react-aria-components';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Dialog, DialogContent, DialogTitle } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';
import { nativeScrollAreaStyles } from '@zivoe/ui/core/native-scroll-area';
import { SelectTrigger } from '@zivoe/ui/core/select';
import { SearchIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useTokenBalances } from '@/hooks/useBalance';

import { type TransactionIdentity } from '@/centrifuge';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { ChainBalanceDetail } from './chain-balance-detail';
import {
  type ChainSelectorRow,
  ChainTokenTriggerContent,
  TokenSelectorDialogRow,
  groupRowsByChain,
  identityRowId,
  selectorTokenOf,
  sortRowsByBalance,
  tokenOnChainLabel
} from './chain-token-selector';

type NetworkFilter = 'all' | CentrifugeChain;

/**
 * The deposit tab's coin picker: every coin of every chain the Zivoe Vault is
 * live on, as a two-pane dialog — networks on the left, coins behind a search
 * on the right — since nine chains with several coins apiece outgrow a flat
 * list. Takes the page's identities and hands one back; rows, balances and
 * their order are its own. Below lg the networks pane is an icon rail.
 */
export function DepositAssetPicker({
  identities,
  selected,
  onSelect,
  isDisabled
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  selected: TransactionIdentity;
  onSelect: (identity: TransactionIdentity) => void;
  isDisabled: boolean;
}) {
  const balanceOf = useTokenBalances(
    identities.map(({ centrifugeVault }) => ({
      chain: centrifugeVault.chain,
      tokenAddress: centrifugeVault.asset.address
    }))
  );
  const rows = sortRowsByBalance(
    identities.map((identity) => ({
      id: identityRowId(identity),
      chain: identity.centrifugeVault.chain,
      token: selectorTokenOf(identity.centrifugeVault.asset.symbol),
      detail: <ChainBalanceDetail identity={identity} token="asset" />,
      identity
    })),
    // Scaled to 18 decimals so coins of different scales compare by amount.
    ({ identity: { centrifugeVault } }) => {
      const balance = balanceOf({ chain: centrifugeVault.chain, tokenAddress: centrifugeVault.asset.address });
      return balance === undefined ? undefined : balance * 10n ** BigInt(18 - centrifugeVault.asset.decimals);
    }
  );
  const selectedToken = selectorTokenOf(selected.centrifugeVault.asset.symbol);
  const selectedChain = selected.centrifugeVault.chain;

  return (
    <Dialog>
      {/* An aria-label replaces the visible content, so it carries the selection too. */}
      <SelectTrigger
        variant="border-light"
        aria-label={`Select token to deposit, currently ${tokenOnChainLabel(selectedToken, selectedChain)}`}
        className="h-auto w-34 justify-between gap-2 py-1"
        isDisabled={isDisabled}
      >
        <ChainTokenTriggerContent token={selectedToken} chain={selectedChain} variant="token-on-chain" />
      </SelectTrigger>

      {/* Below lg the picker opens over the Earn dialog, whose backdrop is
          already up: a second one stacked to twice the darkening. */}
      <DialogContent
        dialogClassName="gap-0"
        className="max-w-190"
        overlayClassName="bg-transparent backdrop-blur-none lg:bg-surface-contrast/40 lg:backdrop-blur-xs"
      >
        {({ close }) => (
          <DepositAssetPickerPanes
            rows={rows}
            selectedId={identityRowId(selected)}
            onSelect={(id) => {
              const next = rows.find((row) => row.id === id)?.identity;
              if (next) onSelect(next);
              close();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dialog's body. Its own component so the filter, the search and the row
 * order reset every time the dialog opens (DialogContent mounts its children
 * per open).
 */
function DepositAssetPickerPanes({
  rows: liveRows,
  selectedId,
  onSelect
}: {
  rows: Array<ChainSelectorRow>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [network, setNetwork] = useState<NetworkFilter>('all');
  const [search, setSearch] = useState('');
  const networksHeadingId = useId();

  // Balances land one chain at a time, and re-sorting on each would move the
  // rows under the pointer, so the order is fixed at open.
  const [orderAtOpen] = useState(() => new Map(liveRows.map((row, index) => [row.id, index])));
  const rank = (row: ChainSelectorRow) => orderAtOpen.get(row.id) ?? orderAtOpen.size;
  const rows = [...liveRows].sort((a, b) => rank(a) - rank(b));

  const groups = groupRowsByChain(rows);
  // A single-selection toggle group (a radio group to assistive tech); the
  // lookup keeps the filter typed without a cast.
  const filters: Array<NetworkFilter> = ['all', ...groups.map((group) => group.chain)];
  const selectNetwork = (keys: Iterable<Aria.Key>) => {
    const chosen = new Set(keys);
    const next = filters.find((filter) => chosen.has(filter));
    if (next) setNetwork(next);
  };
  // The search matches the coin only, never the network: networks have their own list.
  const query = search.trim().toLowerCase();
  const matchesSearch = (row: ChainSelectorRow) =>
    query === '' ||
    row.token.label.toLowerCase().includes(query) ||
    (row.token.description?.toLowerCase().includes(query) ?? false);
  const visible = rows.filter((row) => (network === 'all' || row.chain === network) && matchesSearch(row));

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between px-4 pt-4 pr-14">
        {/* The suffix would wrap the title beside the close button on phones. */}
        <DialogTitle>
          Select token<span className="hidden sm:inline"> to deposit</span>
        </DialogTitle>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3 lg:grid-cols-[13.5rem_1fr]">
        {/* The rail sets the dialog's height (the coins pane is absolutely
            positioned in its cell), so it is capped to the visual viewport and
            scrolls itself: ten chains plus "All networks" outgrow a phone, and
            an uncapped rail would scroll the whole modal, search box included.
            The 1px inset keeps a button's focus ring inside the scroll box. */}
        <div
          className={nativeScrollAreaStyles({
            className: 'flex max-h-[calc(var(--visual-viewport-height)-8.5rem)] min-h-0 flex-col gap-1 px-2 py-px'
          })}
        >
          {/* not-sr-only resets padding, so the inset must ride the lg variant. */}
          <p
            id={networksHeadingId}
            className="sr-only text-extraSmall font-medium text-secondary lg:not-sr-only lg:px-2 lg:pb-1"
          >
            Networks
          </p>
          <Aria.ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            orientation="vertical"
            selectedKeys={[network]}
            onSelectionChange={selectNetwork}
            aria-labelledby={networksHeadingId}
            className="flex flex-col gap-1"
          >
            <NetworkButton
              id="all"
              count={rows.length}
              label="All networks"
              icon={<AllNetworksIcon chains={groups.map((group) => group.chain)} />}
            />
            {groups.map((group) => (
              <NetworkButton
                key={group.chain}
                id={group.chain}
                count={group.rows.length}
                label={CHAIN_DISPLAY[group.chain].label}
                icon={<NetworkIcon chain={group.chain} />}
              />
            ))}
          </Aria.ToggleButtonGroup>
        </div>

        {/* The networks pane alone sets the dialog's height: the coins pane is
            absolutely positioned in its cell and scrolls inside, so a search
            no longer resizes the dialog per keystroke. min-w-0 keeps the
            search input from pushing the cell past the dialog on phones. */}
        <div className="relative min-w-0">
          <div className="absolute inset-0 flex flex-col gap-2 rounded-2xl bg-surface-base p-3 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
            <Input
              variant="search"
              groupClassName="h-12"
              aria-label="Search a token"
              // 'Search tokens' is 89px in Instrument Sans, inside the 94px a 320px
              // phone leaves the field; truncate turns any residual overflow into an
              // ellipsis instead of a cut glyph.
              placeholder="Search tokens"
              inputClassName="truncate"
              value={search}
              onChange={setSearch}
              startContent={<SearchIcon className="size-4 text-icon-default" />}
              isClearable
              clearButtonAriaLabel="Clear search"
              clearButtonClassName="text-icon-default opacity-100 transition-colors hover:text-primary"
            />

            {/* pr-2 keeps the balances clear of the scrollbar. The 1px padding
                and matching negative margin make room for a row's focus ring,
                which the scroll box would otherwise clip at the top and bottom. */}
            <div
              className={nativeScrollAreaStyles({ className: '-m-1 mr-0 flex min-h-0 flex-1 flex-col gap-1 p-1 pr-2' })}
            >
              {visible.map((row) => (
                <TokenSelectorDialogRow
                  key={row.id}
                  row={row}
                  // Under one network the chain is already named; across all, each row names its own.
                  label={network === 'all' ? tokenOnChainLabel(row.token, row.chain) : row.token.label}
                  isSelected={row.id === selectedId}
                  onPress={() => onSelect(row.id)}
                />
              ))}

              {visible.length === 0 && (
                <p className="px-2 py-6 text-center text-small text-secondary">
                  No token matches &ldquo;{search.trim()}&rdquo;
                  {network !== 'all' ? ` on ${CHAIN_DISPLAY[network].label}` : ''}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkButton({
  id,
  count,
  label,
  icon
}: {
  id: NetworkFilter;
  count: number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Aria.ToggleButton
      id={id}
      className={({ isSelected }) =>
        cn(
          'flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-0',
          isSelected && 'bg-surface-base font-medium shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.12)]'
        )
      }
    >
      {({ isSelected }) => (
        <>
          <span className="flex items-center gap-3">
            {icon}
            <span className="sr-only text-small text-primary lg:not-sr-only">{label}</span>
          </span>
          <span
            className={cn(
              'sr-only text-small tabular-nums lg:not-sr-only',
              isSelected ? 'text-primary' : 'text-secondary'
            )}
          >
            {count}
          </span>
        </>
      )}
    </Aria.ToggleButton>
  );
}

function NetworkIcon({ chain }: { chain: CentrifugeChain }) {
  const { Icon } = CHAIN_DISPLAY[chain];
  return <Icon className="size-7 rounded-full" />;
}

/** A small cluster of the first chains' icons — "all of these". */
function AllNetworksIcon({ chains }: { chains: Array<CentrifugeChain> }) {
  return (
    <span className="grid size-7 shrink-0 grid-cols-2 gap-px">
      {chains.slice(0, 4).map((chain) => {
        const { Icon } = CHAIN_DISPLAY[chain];
        return <Icon key={chain} className="size-full rounded-full" />;
      })}
    </span>
  );
}
