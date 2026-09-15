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

/** The picker's network filter: every chain, or one of them. */
type NetworkFilter = 'all' | CentrifugeChain;

/**
 * The deposit tab's coin picker: every coin of every chain the Zivoe Vault is
 * live on, as a two-pane dialog at every width — networks on the left with
 * how many coins each accepts, the coins on the right behind a token search —
 * because nine chains with several coins apiece outgrow a flat list. Takes the
 * page's Transaction Identities and hands one back: the rows (one per
 * Centrifuge vault, with the wallet's balance of THAT coin on THAT chain),
 * their order by where the money is, and the vault key are all its own.
 * Below lg the networks pane collapses to an icon rail rather than a
 * different control, so a phone and a desktop pick a coin the same way.
 */
export function DepositAssetPicker({
  identities,
  selected,
  onSelect,
  isDisabled
}: {
  /** Every Centrifuge vault the Zivoe Vault is live on, in catalog order. */
  identities: ReadonlyArray<TransactionIdentity>;
  selected: TransactionIdentity;
  onSelect: (identity: TransactionIdentity) => void;
  isDisabled: boolean;
}) {
  // Every vault's deposit asset, to order the list by where the money is.
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
    // Compared at one scale: a raw 18-decimal balance (BNB Smart Chain's
    // USDC) would otherwise outrank every 6-decimal one, whatever the amounts.
    ({ identity: { centrifugeVault } }) => {
      const balance = balanceOf({ chain: centrifugeVault.chain, tokenAddress: centrifugeVault.asset.address });
      return balance === undefined ? undefined : balance * 10n ** BigInt(18 - centrifugeVault.asset.decimals);
    }
  );
  const selectedToken = selectorTokenOf(selected.centrifugeVault.asset.symbol);
  const selectedChain = selected.centrifugeVault.chain;

  return (
    <Dialog>
      {/* The name carries the selection: an aria-label replaces the visible
          content, and a control named only by its purpose never tells a
          screen reader (or a voice command) which token is chosen. */}
      <SelectTrigger
        variant="border-light"
        aria-label={`Select token to deposit, currently ${tokenOnChainLabel(selectedToken, selectedChain)}`}
        className="h-auto w-34 justify-between gap-2 py-1"
        isDisabled={isDisabled}
      >
        <ChainTokenTriggerContent token={selectedToken} chain={selectedChain} variant="token-on-chain" />
      </SelectTrigger>

      <DialogContent dialogClassName="gap-0" className="max-w-190">
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
 * The dialog's body. Its own component so the filter and search reset every
 * time the dialog opens (DialogContent mounts its children per open).
 */
function DepositAssetPickerPanes({
  rows,
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

  const groups = groupRowsByChain(rows);
  // The filter is one choice among several, so it is a single-selection
  // toggle group (a radio group to assistive tech, with arrow-key movement)
  // rather than independent pressed buttons. Selection keys are the filter
  // values themselves; the lookup keeps the state typed without a cast.
  const filters: Array<NetworkFilter> = ['all', ...groups.map((group) => group.chain)];
  const selectNetwork = (keys: Iterable<Aria.Key>) => {
    const chosen = new Set(keys);
    const next = filters.find((filter) => chosen.has(filter));
    if (next) setNetwork(next);
  };
  // The search matches the coin only — symbol or name — never the network:
  // networks have their own list, and one box filtering both would leave
  // "USDC on Base" ambiguous about which half matched.
  const query = search.trim().toLowerCase();
  const matchesSearch = (row: ChainSelectorRow) =>
    query === '' ||
    row.token.label.toLowerCase().includes(query) ||
    (row.token.description?.toLowerCase().includes(query) ?? false);
  const visible = rows.filter((row) => (network === 'all' || row.chain === network) && matchesSearch(row));

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between px-4 pt-4 pr-14">
        {/* The suffix wraps the title onto two lines beside the close button at phone widths. */}
        <DialogTitle>
          Select token<span className="hidden sm:inline"> to deposit</span>
        </DialogTitle>
      </div>

      {/* Below lg the networks pane is an icon rail: the same buttons with their text kept for screen readers only. */}
      <div className="grid grid-cols-[auto_1fr] gap-3 lg:grid-cols-[13.5rem_1fr]">
        <div className="flex flex-col gap-1 px-2">
          {/* The inset rides the lg variant: not-sr-only resets padding, and its rule lands after the plain px-2. */}
          <p
            id={networksHeadingId}
            className="sr-only text-extraSmall font-medium text-tertiary lg:not-sr-only lg:px-2 lg:pb-1"
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

        {/* The networks pane alone sets the dialog's height: the coins pane
            is absolutely positioned inside its grid cell, so it adds nothing
            to the row and instead fills whatever height the networks take,
            and the coin list scrolls within it. Without this the dialog grew
            and shrank with every keystroke in the search. min-w-0: a grid
            child's minimum is its content's, and the search input's intrinsic
            width would otherwise push the cell past the dialog's edge at
            phone widths. */}
        <div className="relative min-w-0">
          <div className="absolute inset-0 flex flex-col gap-2 rounded-2xl bg-surface-base p-3 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
            <Input
              variant="search"
              groupClassName="h-12"
              aria-label="Search a token"
              placeholder="Search a token"
              value={search}
              onChange={setSearch}
              startContent={<SearchIcon className="size-4 text-icon-default" />}
            />

            <div className={nativeScrollAreaStyles({ className: 'flex min-h-0 flex-1 flex-col gap-1' })}>
              {visible.map((row) => (
                <TokenSelectorDialogRow
                  key={row.id}
                  row={row}
                  // Under one network the chain is in the list's title; across all of them each row names its own.
                  label={network === 'all' ? tokenOnChainLabel(row.token, row.chain) : row.token.label}
                  isSelected={row.id === selectedId}
                  onPress={() => onSelect(row.id)}
                />
              ))}

              {visible.length === 0 && (
                <p className="px-2 py-6 text-center text-small text-tertiary">
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

/** One network filter option; selection state comes from the enclosing toggle group. */
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
              isSelected ? 'text-primary' : 'text-tertiary'
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
