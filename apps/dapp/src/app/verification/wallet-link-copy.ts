import { getAddress, isAddress } from 'viem';

import { type WalletLinkActionError } from '@/server/actions/wallet-link';
import { type MembershipSummary } from '@/server/wallet-link/wallet-link-membership';

// Every user-facing word of the Wallets step that is not markup: refusal
// copy, badge copy and the time labels. Imports nothing from
// `@/server` but types, so the client tree renders it without the wiring.

/** `0x8815…e9e6` — checksummed, so a stored lowercase address and the wallet's own spelling read the same. */
export const shortAddress = (address: string) => {
  const spelled = isAddress(address) ? getAddress(address) : address;
  return `${spelled.slice(0, 6)}…${spelled.slice(-4)}`;
};

/** "just now", "5 minutes ago", "3 days ago"; a date past a month. */
export function formatRelativeTime(date: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return `on ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

/**
 * The whitelist badge: green only when the chain says member everywhere.
 * Short of that it is "pending" for an address this account has requested and
 * "not whitelisted" for one it has not; a tooltip explains a partial answer.
 * A read some chain did not answer claims neither: "not checked".
 */
export function presentWhitelist({ summary, isRequested }: { summary: MembershipSummary; isRequested: boolean }): {
  label: string;
  tone: 'success' | 'pending' | 'neutral';
  detail: string | null;
} {
  if (summary.status === 'whitelisted') return { label: 'Whitelisted', tone: 'success', detail: null };
  if (summary.status === 'unchecked') {
    return {
      label: 'Not checked',
      tone: 'neutral',
      detail:
        summary.total === 0
          ? 'No chain to check'
          : summary.unknown === 1
            ? "Couldn't check one chain"
            : `Couldn't check ${summary.unknown} of ${summary.total} chains`
    };
  }

  const detail = summary.status === 'partial' ? `Whitelisted on ${summary.memberOn} of ${summary.total} chains` : null;
  return isRequested
    ? { label: 'Whitelist pending', tone: 'pending', detail }
    : { label: 'Not whitelisted', tone: 'neutral', detail };
}

/** What the toast says when a request is refused — one sentence per answer the actions can give. */
export const LINK_REFUSAL_COPY: Record<WalletLinkActionError['code'], string> = {
  unauthorized: 'Sign in again to continue.',
  invalid_input: 'This address or network is not supported.',
  rate_limited: 'Too many attempts. Please try again in a few minutes.',
  failed: 'Could not request the whitelist. Please try again.',
  not_approved: 'Only a verified account can request a whitelist.',
  flagged: "This address can't be whitelisted.",
  already_linked: 'You have already requested a whitelist for this address.',
  no_challenge: 'The signing request is no longer valid. Try again.',
  expired: 'The signing request expired. Sign again to request the whitelist.',
  bad_signature:
    "The signature didn't match this address, or the network could not be reached. Try again from the same wallet in a moment."
};
