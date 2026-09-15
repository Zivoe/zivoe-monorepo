'use client';

import { useState } from 'react';

import * as Aria from 'react-aria-components';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Dialog, DialogContent, DialogTitle } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';
import { SelectTrigger } from '@zivoe/ui/core/select';
import { SearchIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import {
  type ChainSelectorRow,
  ChainTokenTriggerContent,
  TokenSelectorDialogRow,
  groupRowsByChain,
  tokenOnChainLabel
} from './chain-token-selector';

/** The picker's network filter: every chain, or one of them. */
type NetworkFilter = 'all' | CentrifugeChain;

/**
 * The deposit tab's coin picker: every coin of every chain the Zivoe Vault is
 * live on, as a two-pane dialog at every width — networks on the left with
 * how many coins each accepts, the coins on the right behind a token search —
 * because nine chains with several coins apiece outgrow a flat list. Each row
 * shows the wallet's balance of THAT coin on THAT chain. Below lg the networks
 * pane collapses to an icon rail rather than a different control, so a phone
 * and a desktop pick a coin the same way.
 */
export function DepositAssetPicker({
  rows,
  selectedId,
  onSelect,
  isDisabled
}: {
  /** Every Centrifuge vault as a row, in the order the list should show them (balance-sorted by the flow). */
  rows: Array<ChainSelectorRow>;
  selectedId: string;
  onSelect: (id: string) => void;
  isDisabled: boolean;
}) {
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  if (!selected) throw new Error('DepositAssetPicker needs at least one row.');

  return (
    <Dialog>
      <SelectTrigger
        variant="border-light"
        aria-label="Select token to deposit"
        className="h-auto w-34 justify-between gap-2 py-1"
        isDisabled={isDisabled}
      >
        <ChainTokenTriggerContent token={selected.token} chain={selected.chain} variant="token-on-chain" />
      </SelectTrigger>

      <DialogContent dialogClassName="gap-0" className="max-w-190">
        {({ close }) => (
          <DepositAssetPickerPanes
            rows={rows}
            selectedId={selected.id}
            onSelect={(id) => {
              onSelect(id);
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

  const groups = groupRowsByChain(rows);
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
        <nav aria-label="Networks" className="flex flex-col gap-1 px-2">
          <p className="px-2 pb-1 text-extraSmall font-medium text-tertiary sr-only lg:not-sr-only">Networks</p>
          <NetworkButton
            isSelected={network === 'all'}
            onPress={() => setNetwork('all')}
            count={rows.length}
            label="All networks"
            icon={<AllNetworksIcon chains={groups.map((group) => group.chain)} />}
          />
          {groups.map((group) => (
            <NetworkButton
              key={group.chain}
              isSelected={network === group.chain}
              onPress={() => setNetwork(group.chain)}
              count={group.rows.length}
              label={CHAIN_DISPLAY[group.chain].label}
              icon={<NetworkIcon chain={group.chain} />}
            />
          ))}
        </nav>

        <div className="flex min-h-80 flex-col gap-2 rounded-2xl bg-surface-base p-3 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
          <Input
            variant="search"
            groupClassName="h-12"
            aria-label="Search a token"
            placeholder="Search a token"
            value={search}
            onChange={setSearch}
            startContent={<SearchIcon className="size-4 text-icon-default" />}
          />

          <div className="flex flex-col gap-1">
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
  );
}

function NetworkButton({
  isSelected,
  onPress,
  count,
  label,
  icon
}: {
  isSelected: boolean;
  onPress: () => void;
  count: number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Aria.Button
      onPress={onPress}
      aria-pressed={isSelected}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left outline-hidden hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-0',
        isSelected && 'bg-surface-base font-medium shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.12)]'
      )}
    >
      <span className="flex items-center gap-3">
        {icon}
        <span className="text-small text-primary sr-only lg:not-sr-only">{label}</span>
      </span>
      <span
        className={cn('text-small tabular-nums sr-only lg:not-sr-only', isSelected ? 'text-primary' : 'text-tertiary')}
      >
        {count}
      </span>
    </Aria.Button>
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
