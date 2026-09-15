'use client';

import { Disclosure, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';
import { ScrollArea, ScrollBar } from '@zivoe/ui/core/scroll-area';
import { Skeleton } from '@zivoe/ui/core/skeleton';

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
 * chain and coin: requests being processed, proceeds ready to claim,
 * cancellations unwinding, shares returned, claims awaiting liquidity. The
 * redeem tab keeps only the form; the strips it used to stack above it
 * render here, one collapsible group per chain, exactly as before — each
 * row's action offers the network switch while the wallet is elsewhere.
 */
export default function RequestsFlow() {
  const account = useAccount();
  const { chains, count, isPending } = useRedemptionRequests();

  if (account.isDisconnected)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-small text-secondary">
          Connect your wallet to see your redemption requests, funds ready to claim and cancellations in progress.
        </p>
        <ConnectedAccount>{null}</ConnectedAccount>
      </div>
    );

  // Until the wallet SDK has settled and every vault has answered once, the
  // tab holds the shape of a chain group rather than a verdict: the connect
  // prompt above is only for a wallet known to be absent, not one still loading.
  if (!account.address || (chains.length === 0 && isPending)) return <RequestsSkeleton />;

  if (chains.length === 0)
    return (
      <p className="py-6 text-center text-small text-secondary">
        No redemption requests. Requests you make on the Redeem tab, funds ready to claim, and cancellations in progress
        will appear here.
      </p>
    );

  // Capped a little above the redeem form's height and scrolled inside: the
  // Earn box is sticky, so a tab that grows past the viewport would pin its
  // last rows out of reach until the page itself runs out. A thin scrollbar
  // rides the right edge, so the rows keep clear of it.
  return (
    <ScrollArea className="-mr-2 max-h-120" viewportClassName="max-h-120">
      <div className="flex flex-col gap-2 pr-2" aria-label={`${String(count)} redemption requests`}>
        {chains.map((group) => (
          <RequestsChainGroup key={group.chain} group={group} />
        ))}
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}

/** A chain group's silhouette — header row and one strip — so loading and loaded share a layout. */
function RequestsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading redemption requests">
      <div className="flex items-center gap-2 px-1 py-2">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-sm" />
      </div>
      <Skeleton className="h-14 w-full rounded-sm" />
    </div>
  );
}

/**
 * One chain's positions, expanded by default. Access verdicts are per chain
 * (a share-token fact), so they are read here, once, and handed to every
 * vault's strips. The chain's switch is offered on every row while the
 * wallet sits elsewhere; taking it also moves the shared chain selection, so
 * the deposit and redeem tabs follow.
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

  // Hub-level, shared by every chain; read per group so the price arrives
  // with the group rather than gating the whole tab.
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
            <p className="text-extraSmall text-tertiary">
              Could not load every position on {label}.
            </p>
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
