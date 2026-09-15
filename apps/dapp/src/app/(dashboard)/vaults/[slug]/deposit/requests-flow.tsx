'use client';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Callout } from '@zivoe/ui/core/callout';
import { Disclosure, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';
import { ScrollArea, ScrollBar } from '@zivoe/ui/core/scroll-area';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useAccount } from '@/hooks/useAccount';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';

import ConnectedAccount from '@/components/connected-account';

import { useInvestorAccess } from '@/centrifuge';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { useChainSwitch, useSelectedChain } from './_components/chain-switch';
import { RedemptionPositionStrips, deriveRedeemAccessGates } from './_components/redemption-position-strips';
import { useEarnDialog } from './_hooks/earn-dialog';
import { type RedemptionRequestsByChain, useRedemptionRequests } from './_hooks/use-redemption-requests';

/**
 * Everything the wallet has in flight with this Zivoe Vault, across every
 * chain and coin, one collapsible group per chain. Each row's action offers
 * the network switch while the wallet is elsewhere.
 */
export default function RequestsFlow() {
  const account = useAccount();
  const { chains, isPending, pendingChains } = useRedemptionRequests();

  if (account.isDisconnected)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-small text-secondary">
          Connect your wallet to see your redemption requests, funds ready to claim and cancellations in progress.
        </p>
        <ConnectedAccount>{null}</ConnectedAccount>
      </div>
    );

  // A skeleton until the wallet SDK has settled and the first vault has
  // answered; the chains still reading are named below whatever has landed.
  if (!account.address || isPending) return <RequestsSkeleton />;

  if (chains.length === 0)
    return (
      <div className="flex flex-col gap-2 py-6 text-center text-small text-secondary">
        <p>
          No redemption requests. Requests you make on the Redeem tab, funds ready to claim, and cancellations in
          progress will appear here.
        </p>
        <StillChecking chains={pendingChains} />
      </div>
    );

  // From lg the Earn box is sticky, so the list is capped and scrolls inside;
  // below lg the Earn dialog scrolls as a whole, and a second scroller would
  // hide rows behind an invisible touch scrollbar. The cap follows the
  // viewport: the sticky box's chrome plus a fixed 480px list outgrew a
  // laptop's 650px of inner height, hiding the list's end and its scrollbar.
  return (
    <ScrollArea
      className="-mr-2 lg:max-h-[min(30rem,calc(100dvh-16rem))]"
      viewportClassName="lg:max-h-[min(30rem,calc(100dvh-16rem))]"
    >
      <div className="flex flex-col gap-2 pr-2">
        {chains.map((group) => (
          <RequestsChainGroup key={group.chain} group={group} />
        ))}
        <StillChecking chains={pendingChains} className="px-1 py-2 text-extraSmall" />
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}

/** Names the chains whose first position read is still in flight; nothing once all have answered. */
function StillChecking({ chains, className }: { chains: Array<CentrifugeChain>; className?: string }) {
  if (chains.length === 0) return null;
  return (
    <p aria-live="polite" className={cn('text-secondary', className)}>
      Still checking {chains.map((chain) => CHAIN_DISPLAY[chain].label).join(', ')}…
    </p>
  );
}

/** A chain group's silhouette, so loading and loaded share a layout. */
function RequestsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading redemption requests" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 py-2">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-sm" />
      </div>
      <Skeleton className="h-14 w-full rounded-sm" />
    </div>
  );
}

/**
 * One chain's positions. Access verdicts are a share-token fact, so they are
 * read once here and handed to every vault's strips; taking the chain switch
 * also moves the shared chain selection, so the other tabs follow.
 */
function RequestsChainGroup({ group }: { group: RedemptionRequestsByChain }) {
  const { chain, entries, count } = group;
  const [first] = entries;
  const { label, Icon } = CHAIN_DISPLAY[chain];

  const account = useAccount();
  const chainalysis = useChainalysis();
  const { setSelectedChain } = useSelectedChain();
  const { isWalletOffChain } = useChainSwitch();
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

  // Hub-level; read per group so the price never gates the whole tab.
  const metrics = useCurrentShareMetrics({ shareClassKey: first.identity.centrifugeVault.shareClass.key });
  const access = useInvestorAccess({ centrifugeVault: first.identity.centrifugeVault });
  const gates = deriveRedeemAccessGates(access);
  const sharePrice = metrics.data ? BigInt(metrics.data.sharePriceD18) : undefined;

  const isWriteBlocked = account.isPending || chainalysis.isFetching || access.isFetching;
  const switchChain = isWalletOffChain(chain)
    ? { label: `Switch to ${label}`, onPress: () => setSelectedChain(chain) }
    : undefined;

  return (
    <Disclosure defaultExpanded className="py-0">
      <DisclosureHeader className="px-1 py-2 text-regular! font-medium hover:no-underline">
        <span className="flex items-center gap-2">
          <Icon className="size-5 rounded-full" />
          {label}
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-extraSmall font-medium text-secondary tabular-nums">
            {count}
          </span>
        </span>
      </DisclosureHeader>

      <DisclosurePanel>
        <div className="flex flex-col gap-2 pb-2">
          {entries.some((entry) => entry.isError) && (
            <Callout variant="warning">Could not load every position on {label}.</Callout>
          )}

          {entries.map(({ identity }) => (
            <RedemptionPositionStrips
              key={identity.centrifugeVault.address}
              identity={identity}
              labelAsset={entries.length > 1}
              gates={gates}
              sharePrice={sharePrice}
              isWriteBlocked={isWriteBlocked}
              switchChain={switchChain}
              onSuccessClose={() => setIsEarnDialogOpen(false)}
            />
          ))}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
