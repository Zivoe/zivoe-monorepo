'use client';

import { useState } from 'react';

import * as Aria from 'react-aria-components';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Dialog, DialogContent, DialogTitle } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger } from '@zivoe/ui/core/select';
import { SearchIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import {
  ChainBadgedTokenIcon,
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
 * live on. On desktop a two-pane dialog — networks on the left with how many
 * coins each accepts, the coins on the right behind a token search — because
 * nine chains with several coins apiece outgrow a flat list. Each row shows
 * the wallet's balance of THAT coin on THAT chain. On mobile the compact
 * Select over the same rows, sectioned where a chain has several coins.
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

  const groups = groupRowsByChain(rows);

  return (
    <>
      <Dialog>
        <SelectTrigger
          variant="border-light"
          className="hidden h-auto w-34 justify-between gap-2 py-1 lg:flex"
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

      <Select
        placeholder="Select"
        aria-label="Select token to deposit"
        selectedKey={selected.id}
        onSelectionChange={(key) => {
          const row = rows.find((candidate) => candidate.id === key);
          if (row) onSelect(row.id);
        }}
        isDisabled={isDisabled}
      >
        <SelectTrigger variant="border-light" className="h-auto w-34 justify-between gap-2 py-1 lg:hidden">
          <ChainTokenTriggerContent token={selected.token} chain={selected.chain} variant="token-on-chain" />
        </SelectTrigger>

        <SelectPopover>
          <SelectListBox>
            {groups.map((group) =>
              group.rows.length > 1 ? (
                <Aria.ListBoxSection key={group.chain} id={group.chain}>
                  <Aria.Header>
                    <NetworkLabel chain={group.chain} className="px-2 pt-1 pb-1 text-extraSmall text-tertiary" />
                  </Aria.Header>
                  {group.rows.map((row) => (
                    <DepositAssetItem key={row.id} row={row} />
                  ))}
                </Aria.ListBoxSection>
              ) : (
                group.rows.map((row) => <DepositAssetItem key={row.id} row={row} />)
              )
            )}
          </SelectListBox>
        </SelectPopover>
      </Select>
    </>
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
        <DialogTitle>Select token to deposit</DialogTitle>
      </div>

      <div className="grid gap-3 lg:grid-cols-[13.5rem_1fr]">
        <nav aria-label="Networks" className="flex flex-col gap-1 px-2">
          <p className="px-2 pb-1 text-extraSmall font-medium text-tertiary">Networks</p>
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
        <span className="text-small text-primary">{label}</span>
      </span>
      <span className={cn('text-small tabular-nums', isSelected ? 'text-primary' : 'text-tertiary')}>{count}</span>
    </Aria.Button>
  );
}

function NetworkLabel({ chain, className }: { chain: CentrifugeChain; className?: string }) {
  const { label, Icon } = CHAIN_DISPLAY[chain];
  return (
    <span className={cn('flex items-center gap-2 font-medium', className)}>
      <Icon className="size-4 rounded-full" />
      {label}
    </span>
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

function DepositAssetItem({ row }: { row: ChainSelectorRow }) {
  return (
    <SelectItem
      id={row.id}
      textValue={tokenOnChainLabel(row.token, row.chain)}
      className="flex items-center gap-2"
      showCheckmark={false}
    >
      <ChainBadgedTokenIcon chain={row.chain} icon={row.token.icon} className="size-5" />
      {tokenOnChainLabel(row.token, row.chain)}
    </SelectItem>
  );
}
