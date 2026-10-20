'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { isEthereumWallet } from '@dynamic-labs/ethereum';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { WalletIcon } from '@dynamic-labs/wallet-book';
import * as Sentry from '@sentry/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useConnection, useSwitchChain } from 'wagmi';

import { Badge } from '@zivoe/ui/core/badge';
import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { toast } from '@zivoe/ui/core/sonner';
import { Tooltip, TooltipFocusable, TooltipTrigger } from '@zivoe/ui/core/tooltip';
import { CheckCircleIcon, ClockIcon, WarningIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import {
  type WalletLinkActionError,
  completeWalletLink,
  issueWalletLinkChallenge,
  listWalletLinks
} from '@/server/actions/wallet-link';
import { type MembershipSummary } from '@/server/wallet-link/wallet-link-membership';
import { toSignableTypedData } from '@/server/wallet-link/wallet-link-typed-data';
import { type LinkedAddress } from '@/server/wallet-link/wallet-link-view';

import { DEFAULT_CHAIN, getChainId, isActiveChainId } from '@/lib/chains';
import { EMAILS } from '@/lib/emails';
import { queryKeys } from '@/lib/query-keys';

import { useAccount } from '@/hooks/useAccount';
import { useChainalysis } from '@/hooks/useChainalysis';

import { Auth } from '@/app/(auth)/_components/common';

import { useAddressesMembership } from './use-address-membership';
import { LINK_REFUSAL_COPY, formatRelativeTime, presentWhitelist, shortAddress } from './wallet-link-copy';

/**
 * Step 3 of `/verification`: the connected wallet and where it stands with
 * the whitelist. The wallet is the app-wide Dynamic connection, the same one
 * the dashboard uses, and its state is the chain's: whitelisted or not,
 * whoever asked for it. What the account adds is its own Linked addresses
 * (a signature each), kept in the query cache: the page seeds them on the
 * server and a new request writes the action's own answer into it — no local
 * copy to merge, no page refresh. An address is looked at one at a time; no
 * list of past requests is shown.
 */
export function WalletLinkStep({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.app.walletLinks({ userId });
  const { data: links = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listWalletLinks();
      if (!result.ok) throw new Error(`Could not read the whitelist requests: ${result.error.code}`);
      return result.value;
    },
    // Kept for the life of the tab: the router can replay this page's payload
    // from before a write, and only a cache entry that is still here outranks it.
    gcTime: Infinity,
    // A background re-read that fails keeps the card as it is; it is reported, never toasted.
    meta: { skipErrorToast: true }
  });
  const addLink = async (linked: LinkedAddress) => {
    // A re-read that started before the write must not land after it.
    await queryClient.cancelQueries({ queryKey });
    // Hydration keeps whichever side is newer, and the page's payload is
    // stamped by the server's clock: a write is stamped past the entry it
    // changes, so a browser clock that runs behind cannot lose it to a replay.
    const updatedAt = Math.max(Date.now(), (queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0) + 1);
    queryClient.setQueryData<Array<LinkedAddress>>(
      queryKey,
      (current = []) => [linked, ...current.filter((link) => link.id !== linked.id)],
      { updatedAt }
    );
  };

  // A request or a disconnect unmounts the control that had focus (the sign
  // button, Disconnect); the card's heading takes it, so a keyboard or
  // screen-reader user lands on the result.
  const [focusCount, setFocusCount] = useState(0);
  const focusCard = () => setFocusCount((count) => count + 1);
  useEffect(() => {
    if (focusCount > 0) document.getElementById(CARD_HEADING_ID)?.focus();
  }, [focusCount]);

  return (
    <>
      <Auth.Header
        title="Wallets"
        description="Connect the wallet you will invest from to see whether it is whitelisted for Zivoe's vaults. If it is not, sign to request it."
      >
        <Auth.StepIndicator>Step 3 of 3</Auth.StepIndicator>
      </Auth.Header>

      <ConnectedWalletCard
        links={links}
        // A refusal can mean the requests on screen are behind the server
        // (made in another tab), so they are read again. A success is not:
        // the action's own answer is already in the cache.
        onRefused={() => void queryClient.invalidateQueries({ queryKey })}
        onDisconnected={focusCard}
        onLinked={async (linked) => {
          await addLink(linked);
          focusCard();
        }}
      />
    </>
  );
}

const CARD_HEADING_ID = 'connected-wallet-heading';

const SIGN_HELPER =
  'Your wallet will ask for a free signature. If your wallet needs several approvers, have them ready now.';

const SWITCH_HINT = 'To check another address, disconnect and connect another wallet.';

/** A refusal the server named; the copy module has a sentence for each code. */
class LinkRefused extends Error {
  constructor(readonly code: WalletLinkActionError['code']) {
    super(code);
  }
}

/** The wallet said no (EIP-1193 4001, viem's UserRejectedRequestError, or a wallet that says so in words). */
const isWalletRejection = (error: unknown) => {
  const candidate = error as { code?: unknown; name?: unknown; message?: unknown } | null;
  return (
    candidate?.code === 4001 ||
    candidate?.name === 'UserRejectedRequestError' ||
    /user (rejected|denied|cancel)/i.test(typeof candidate?.message === 'string' ? candidate.message : '')
  );
};

// ---------------------------------------------------------------------------
// The connected wallet.
// ---------------------------------------------------------------------------

function ConnectedWalletCard({
  links,
  onLinked,
  onRefused,
  onDisconnected
}: {
  /** This account's Linked addresses: the ones it asked to have whitelisted. */
  links: Array<LinkedAddress>;
  onLinked: (linked: LinkedAddress) => void;
  /** The server refused the request; the ones on screen may be stale. */
  onRefused: () => void;
  onDisconnected: () => void;
}) {
  const { address, isPending: walletLoading } = useAccount();
  const { primaryWallet, setShowAuthFlow, handleLogOut } = useDynamicContext();
  const { chainId } = useConnection();
  const assessment = useChainalysis();
  const switchChain = useSwitchChain();
  const lowercase = address?.toLowerCase() as Address | undefined;
  const linkedRow = lowercase ? links.find((link) => link.address === lowercase) : undefined;
  // The chain's answer for the connected address, read live; `undefined` while it loads.
  const summary = useAddressesMembership(lowercase ? [lowercase] : [])[lowercase ?? '0x'];

  // The page cannot change the wallet's account: the investor switches it in
  // the wallet and this card follows, or disconnects here and connects another.
  const disconnect = async () => {
    try {
      await handleLogOut();
      onDisconnected();
    } catch {
      toast({ type: 'error', title: 'Could not disconnect the wallet' });
    }
  };

  // What a link is for travels as the mutation's variables: the wallet can
  // switch accounts while one is in flight, and the callbacks below run with
  // the latest render. The answer belongs to the address that asked.
  const link = useMutation({
    mutationFn: async ({ address, chainId }: { address: Address; chainId: number }) => {
      if (!primaryWallet || !isEthereumWallet(primaryWallet)) throw new LinkRefused('invalid_input');
      const issued = await issueWalletLinkChallenge({
        address,
        chainId,
        walletType: primaryWallet.key ?? null,
        walletName: primaryWallet.connector?.name ?? null
      });
      if (!issued.ok) throw new LinkRefused(issued.error.code);

      // Straight to the wallet: typed-data signing is exempt from the app's
      // transaction simulation path, and nothing moves on chain.
      const walletClient = await primaryWallet.getWalletClient();
      const signature = await walletClient.signTypedData({
        account: address,
        ...toSignableTypedData(issued.value.typedData)
      });

      const completed = await completeWalletLink({ address, signature });
      if (!completed.ok) throw new LinkRefused(completed.error.code);
      return completed.value;
    },
    onSuccess: (linked) => {
      toast({
        type: 'success',
        title: 'Whitelist requested',
        description: 'We will whitelist this address within one business day.'
      });
      onLinked(linked);
    },
    onError: (error, { address, chainId }) => {
      if (error instanceof LinkRefused) {
        onRefused();
        toast({ type: error.code === 'failed' ? 'error' : 'warning', title: LINK_REFUSAL_COPY[error.code] });
        return;
      }
      // A rejected or timed-out request leaves the challenge in place: the next click reuses it.
      if (isWalletRejection(error)) {
        toast({
          type: 'warning',
          title: 'Signature declined',
          description: 'Nothing was requested. Sign when you are ready.'
        });
        return;
      }
      toast({ type: 'error', title: LINK_REFUSAL_COPY.failed });
      Sentry.captureException(error, { tags: { source: 'CLIENT', flow: 'wallet-link' }, extra: { address, chainId } });
    }
  });

  // The card while its state is not known yet: it commits to nothing and
  // takes the size of the card it most often becomes (the address, the
  // badge, Disconnect beside the switch hint), so settling moves nothing
  // below it. Each bar sits in a box with the text style of the line it
  // stands for, and the hint is the real sentence, hidden, so it wraps as
  // the real one does.
  const placeholder = (
    <Card heading={null}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-md" />
        <div className="flex flex-col">
          <SkeletonLine className="font-paragraph! text-h6" width="w-32" />
          <SkeletonLine className="text-small" width="w-20" />
        </div>
      </div>
      <Skeleton className="h-7 w-28 rounded-sm" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-12 w-full shrink-0 rounded-sm sm:w-30" />
        <Skeleton className="rounded-sm text-small">
          <span className="invisible">{SWITCH_HINT}</span>
        </Skeleton>
      </div>
    </Card>
  );

  // -- The wallet SDK has not answered yet: neither "connect" nor "connected" is known.
  if (walletLoading) return placeholder;

  // -- Nothing connected: the one task.
  if (!address) {
    return (
      <Card heading="Connect a wallet">
        <Button variant="primary" onPress={() => setShowAuthFlow(true)} fullWidth>
          Connect wallet
        </Button>
      </Card>
    );
  }

  const short = shortAddress(address);
  const walletName = primaryWallet?.connector?.name ?? 'Wallet';
  const addressLine = (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-base shadow-[0_0_0_1px] shadow-default">
        <span className="size-5 [&_img]:size-5 [&_svg]:size-5">
          <WalletIcon walletKey={primaryWallet?.connector?.key} />
        </span>
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="font-paragraph! text-h6 font-medium text-primary" title={address}>
          {short}
        </span>
        <span className="text-small text-secondary">{walletName}</span>
      </div>
    </div>
  );
  // Standalone in a column card it keeps its own width on desktop; beside the primary it shares the row.
  const disconnectButton = (
    <Button variant="border-light" onPress={disconnect} className="w-full sm:w-fit">
      Disconnect
    </Button>
  );

  // -- The chains have not answered yet: nothing is claimed about the whitelist.
  if (!summary) return placeholder;

  const switchHint = <p className="text-small text-secondary">{SWITCH_HINT}</p>;

  // -- Whitelisted, whoever asked for it: nothing to do.
  if (summary.status === 'whitelisted') {
    return (
      <Card heading="Connected wallet">
        {addressLine}
        <WhitelistBadge summary={summary} isRequested />
        {/* Beside the button from `sm` up, as in the placeholder this card replaces. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {disconnectButton}
          {switchHint}
        </div>
      </Card>
    );
  }

  // -- Some chain did not answer: nothing is known, so nothing is claimed
  // and nothing is offered — not a signature, not "no longer whitelisted".
  // The hook reads again in a few minutes and on the next return to the tab.
  if (summary.status === 'unchecked') {
    return (
      <Card heading="Connected wallet">
        {addressLine}
        <div className="flex flex-col gap-2">
          <WhitelistBadge summary={summary} isRequested={false} />
          <Note tone="alert">
            Couldn&apos;t read the whitelist right now. We will try again shortly, or reload the page to try now.
          </Note>
        </div>
        {disconnectButton}
      </Card>
    );
  }

  // -- Requested by this account, whitelisted once and no longer: a revoke
  // or a chain added since. Nothing here can ask again, and no email is
  // coming, so the card must not promise one.
  if (linkedRow?.wasWhitelisted) {
    return (
      <Card heading="Connected wallet">
        {addressLine}
        <div className="flex flex-col gap-2">
          <WhitelistBadge summary={summary} isRequested={false} />
          <p className="text-small text-secondary">
            This address was whitelisted and no longer is on every chain. To have it whitelisted again, email{' '}
            <Link href={`mailto:${EMAILS.INQUIRE}`} variant="link-neutral-dark" size="s">
              {EMAILS.INQUIRE}
            </Link>
            .
          </p>
        </div>
        {disconnectButton}
      </Card>
    );
  }

  // -- Requested by this account and not whitelisted yet: ops has it.
  if (linkedRow) {
    return (
      <Card heading="Connected wallet">
        {addressLine}
        <div className="flex flex-col gap-2">
          <WhitelistBadge summary={summary} isRequested />
          {/* Server and client read the clock at different moments; the minute can tick between them. */}
          <p className="text-small text-secondary" suppressHydrationWarning>
            Whitelist requested {formatRelativeTime(linkedRow.signedAt, new Date())}. We whitelist new addresses within
            one business day and will email you when it&apos;s done.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {disconnectButton}
          {switchHint}
        </div>
      </Card>
    );
  }

  // -- wagmi learns of the connection a beat after Dynamic reports the
  // address. A chain not known yet is not an unsupported one: the placeholder
  // holds, or "Switch network" would flash on every load.
  if (chainId === undefined) return placeholder;

  // -- On a chain this deployment does not serve: the signature names a chain, so it must be one of ours.
  if (!isActiveChainId(chainId)) {
    return (
      <Card heading="Connected wallet">
        {addressLine}
        <Note tone="neutral">Switch your wallet to a supported network to continue.</Note>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            onPress={() => switchChain.mutate({ chainId: getChainId(DEFAULT_CHAIN) })}
            isPending={switchChain.isPending}
            pendingContent="Switching…"
            className="w-full sm:w-fit"
          >
            Switch network
          </Button>
          {disconnectButton}
        </div>
      </Card>
    );
  }

  // -- Chainalysis, before any signature: the placeholder stays until it
  // answers. The first answer only: a background refetch after the hour's
  // staleness must not hide the button for a beat.
  if (assessment.isPending) return placeholder;
  if (assessment.isRiskyAddress) {
    return (
      <Card heading="Connected wallet">
        {addressLine}
        <Note tone="alert">This address can&apos;t be whitelisted.</Note>
        {disconnectButton}
      </Card>
    );
  }
  if (!assessment.data) {
    return (
      <Card heading="Connected wallet">
        {addressLine}
        <Note tone="alert">Couldn&apos;t check this address. Reload the page to try again.</Note>
        {disconnectButton}
      </Card>
    );
  }

  // -- Clean, not whitelisted and not requested: sign.
  return (
    <Card heading="Connected wallet">
      {addressLine}
      <WhitelistBadge summary={summary} isRequested={false} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            onPress={() => link.mutate({ address, chainId })}
            isPending={link.isPending}
            pendingContent="Waiting for your wallet…"
            className="w-full sm:w-fit"
          >
            Sign to request whitelist
          </Button>
          {disconnectButton}
        </div>
        <p className="text-small text-secondary">{SIGN_HELPER}</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces.
// ---------------------------------------------------------------------------

/**
 * The step's card. The heading is focusable (not tabbable) so the step can
 * move focus to it after a request or a disconnect. A null heading is the
 * card still loading: a placeholder, announced as such.
 */
function Card({ heading, children }: { heading: string | null; children: ReactNode }) {
  return (
    <section
      aria-labelledby={heading === null ? undefined : CARD_HEADING_ID}
      aria-busy={heading === null}
      className="flex flex-col gap-5 rounded-2xl border border-default bg-surface-elevated p-6"
    >
      {heading === null ? (
        <>
          <SkeletonLine className="font-paragraph! text-leading" width="w-44" />
          <span role="status" className="sr-only">
            Loading wallet…
          </span>
        </>
      ) : (
        <h2
          id={CARD_HEADING_ID}
          tabIndex={-1}
          className="font-paragraph! text-leading font-medium text-primary outline-none"
        >
          {heading}
        </h2>
      )}
      {children}
    </section>
  );
}

/** A bar standing for one line of text: the box takes that text style's line height, the bar sits inside it. */
function SkeletonLine({ className, width }: { className: string; width: string }) {
  return (
    <div className={cn('flex h-[1lh] items-center', className)}>
      <Skeleton className={cn('h-[0.8em] rounded-sm', width)} />
    </div>
  );
}

/** One line of state beneath the address; `alert` is a settled no, `neutral` a next step. */
function Note({ tone, children }: { tone: 'alert' | 'neutral'; children: ReactNode }) {
  return (
    <p
      role="status"
      className={tone === 'alert' ? 'flex items-center gap-2 text-small text-alert' : 'text-small text-secondary'}
    >
      {tone === 'alert' ? <WarningIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
      {children}
    </p>
  );
}

/**
 * Green only on full membership. Anything less is "pending" once this account
 * has asked and "not whitelisted" before, with the reason a hover or focus away.
 */
function WhitelistBadge({ summary, isRequested }: { summary: MembershipSummary; isRequested: boolean }) {
  const { label, tone, detail } = presentWhitelist({ summary, isRequested });
  const badge = (
    <Badge variant={tone === 'success' ? 'primary' : tone === 'pending' ? 'warning' : 'neutral'} className="w-fit">
      {tone === 'success' ? (
        <CheckCircleIcon aria-hidden="true" />
      ) : tone === 'pending' ? (
        <ClockIcon aria-hidden="true" />
      ) : null}
      {label}
    </Badge>
  );
  if (!detail) return badge;

  // A trigger that is not a control is named like the vault icons' are. The
  // name carries the reason too, for a screen reader on touch, where no
  // tooltip opens, or one reading past the badge without focusing it.
  return (
    <TooltipTrigger>
      <TooltipFocusable>
        <span
          role="img"
          aria-label={`${label}, ${detail}`}
          className="inline-flex w-fit rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-default"
        >
          {badge}
        </span>
      </TooltipFocusable>
      <Tooltip>{detail}</Tooltip>
    </TooltipTrigger>
  );
}
