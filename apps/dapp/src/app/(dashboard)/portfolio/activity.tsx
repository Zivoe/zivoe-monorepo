import { useState } from 'react';

import { type Address } from 'viem';

import { type WalletActivity } from '@zivoe/centrifuge-indexer';
import { getChainDeployment } from '@zivoe/centrifuge-indexer';
import { Button } from '@zivoe/ui/core/button';
import { DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { Tab, TabList, TabPanel, Tabs } from '@zivoe/ui/core/tabs';

import { getTokenInfo } from '@/components/token-info';

import { type TransactionIdentity } from '@/centrifuge/types';
import { conversionDirection, groupPortfolioActivity } from '@/portfolio/activity';
import { usePortfolioActivity } from '@/portfolio/use-portfolio';

import { ChainLabel } from './chain-label';
import { Card, amount, dateLabel } from './common';

const LABELS: Record<WalletActivity['type'], string> = {
  DEPOSIT_REQUEST_UPDATED: 'Deposit requested',
  REDEEM_REQUEST_UPDATED: 'Redemption requested',
  DEPOSIT_REQUEST_CANCELLED: 'Deposit cancelled',
  REDEEM_REQUEST_CANCELLED: 'Redemption cancelled',
  DEPOSIT_REQUEST_EXECUTED: 'Deposit processed',
  REDEEM_REQUEST_EXECUTED: 'Redemption processed',
  DEPOSIT_CLAIMABLE: 'Deposit ready to claim',
  REDEEM_CLAIMABLE: 'Redemption approved',
  DEPOSIT_CLAIMED: 'Deposit claimed',
  REDEEM_CLAIMED: 'Proceeds claimed',
  SYNC_DEPOSIT: 'Deposit',
  SYNC_REDEEM: 'Redemption',
  TRANSFER_IN: 'Received',
  TRANSFER_OUT: 'Sent'
};

type DisplayAmount = { value: bigint; decimals: number; symbol: string };

function ActivityAmount({ value, decimals, symbol }: DisplayAmount) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {amount(value, decimals)}
      <span role="img" aria-label={symbol} title={symbol} className="size-4 shrink-0 [&>svg]:size-full">
        {getTokenInfo(symbol)?.icon ?? symbol}
      </span>
    </span>
  );
}
function ActivityRows({
  entries,
  identities
}: {
  entries: Array<WalletActivity>;
  identities: ReadonlyArray<TransactionIdentity>;
}) {
  return (
    <ol role="list" className="divide-y divide-default">
      {entries.map((entry, index) => {
        const vault = identities.find(
          ({ centrifugeVault }) => centrifugeVault.chainId === entry.chainId
        )?.centrifugeVault;
        const isDeposit = entry.type === 'SYNC_DEPOSIT' || entry.type.startsWith('DEPOSIT_');
        const asset = identities.find(
          ({ centrifugeVault }) =>
            centrifugeVault.chainId === entry.chainId &&
            centrifugeVault.asset.address.toLowerCase() === entry.assetAddress?.toLowerCase()
        )?.centrifugeVault.asset;
        const stableAmount =
          asset && entry.currencyAmount !== null
            ? { value: entry.currencyAmount, decimals: asset.decimals, symbol: asset.symbol }
            : null;
        const shareAmount =
          vault && entry.tokenAmount !== null
            ? { value: entry.tokenAmount, decimals: vault.shareClass.decimals, symbol: 'zSMB' }
            : null;
        const direction = conversionDirection(entry);
        const conversion =
          direction && stableAmount && shareAmount
            ? direction === 'deposit'
              ? [stableAmount, shareAmount]
              : [shareAmount, stableAmount]
            : null;
        const primaryAmount = isDeposit ? stableAmount : shareAmount;
        const explorer = vault ? getChainDeployment(vault.chain).viem.blockExplorers?.default.url : undefined;
        return (
          <li
            key={`${entry.centrifugeId}:${entry.txHash}:${entry.type}:${index}`}
            className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-2 py-2.5 first:pt-0"
          >
            <span aria-hidden="true" className="text-extraSmall leading-5 text-secondary tabular-nums">
              {index + 1}.
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              {explorer ? (
                <Link
                  href={`${explorer}/tx/${entry.txHash}`}
                  target="_blank"
                  variant="link-neutral-dark"
                  size="s"
                  className="max-w-full justify-start text-left whitespace-normal"
                >
                  {LABELS[entry.type]}
                </Link>
              ) : (
                <p className="text-small font-medium text-primary">{LABELS[entry.type]}</p>
              )}
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-extraSmall text-secondary">
                {vault ? <ChainLabel chain={vault.chain} /> : <span>Unknown chain</span>}
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true">·</span>
                  {dateLabel(entry.timestampMs)}
                </span>
              </p>
            </div>
            <div className="flex max-w-40 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right text-small text-primary tabular-nums xl:max-w-48">
              {conversion ? (
                <>
                  <ActivityAmount {...conversion[0]!} />
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="text-secondary">
                      →
                    </span>
                    <span className="sr-only">to</span>
                    <ActivityAmount {...conversion[1]!} />
                  </span>
                </>
              ) : primaryAmount ? (
                <ActivityAmount {...primaryAmount} />
              ) : (
                <span className="text-secondary" title="Amount unavailable">
                  —
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export function Activity({
  identities,
  accountAddress
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  accountAddress?: Address;
}) {
  const [transfers, setTransfers] = useState(false);
  const [open, setOpen] = useState(false);
  const activity = usePortfolioActivity(transfers, accountAddress);
  const entries = groupPortfolioActivity(activity.data?.pages.flatMap((page) => page.entries) ?? [], transfers);
  const status = (
    <>
      {activity.isPending && <p className="py-5 text-small text-secondary">Loading activity…</p>}
      {activity.isError && (
        <div className="py-3 text-small text-secondary">
          Activity could not be loaded.{' '}
          <Button variant="link-primary" size="s" onPress={() => void activity.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {activity.isSuccess && !entries.length && (
        <p className="py-5 text-small text-secondary">
          {activity.hasNextPage
            ? 'No standalone transfers in the loaded activity. View all activity to load more.'
            : `No indexed ${transfers ? 'transfers' : 'activity'} yet.`}
        </p>
      )}
    </>
  );
  const renderTabs = (all: boolean) => (
    <Tabs
      selectedKey={transfers ? 'transfers' : 'recent'}
      onSelectionChange={(key) => setTransfers(key === 'transfers')}
    >
      <TabList aria-label="Activity type">
        <Tab id="recent">Recent</Tab>
        <Tab id="transfers">Transfers</Tab>
      </TabList>
      {(['recent', 'transfers'] as const).map((tab) => (
        <TabPanel key={tab} id={tab}>
          <ActivityRows entries={all ? entries : entries.slice(0, 5)} identities={identities} />
          {status}
          {all && activity.hasNextPage && (
            <Button
              variant="border-light"
              isPending={activity.isFetchingNextPage}
              onPress={() => void activity.fetchNextPage()}
            >
              Load more activity
            </Button>
          )}
        </TabPanel>
      ))}
    </Tabs>
  );
  return (
    <Card title="Activity" className="order-6">
      {renderTabs(false)}
      <Button variant="link-primary" size="s" onPress={() => setOpen(true)}>
        View all activity
      </Button>
      <DialogContent isOpen={open} onOpenChange={setOpen} className="max-w-2xl">
        <DialogHeader className="pr-16">
          <DialogTitle>All zSMB activity</DialogTitle>
        </DialogHeader>
        <DialogContentBox>{renderTabs(true)}</DialogContentBox>
      </DialogContent>
    </Card>
  );
}
