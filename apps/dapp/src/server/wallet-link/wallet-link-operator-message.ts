import 'server-only';

import { chainOfChainId } from '@/lib/chains';
import { escapeHtml, truncateAddress } from '@/lib/utils';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { type WalletLinkOperatorKind, type WalletLinkOperatorMessenger, type WalletLinkRecord } from './wallet-link';
import { type AddressMembership, summarizeMembership } from './wallet-link-membership';

const TITLES: Record<WalletLinkOperatorKind, string> = {
  whitelist_request: '🟢 Whitelist request',
  revoke_request: '🔴 Revoke request'
};

/**
 * How many other accounts a Revoke request names before it counts the rest.
 * Connections are self-reported and unbounded; Telegram refuses a message
 * past 4096 characters for good, and a refused Revoke request is one lost.
 */
const OTHER_ACCOUNTS_SHOWN = 10;

/** The chain the message was signed on, by display label; a chain the app does not know shows its id. */
function chainLabel(chainId: number): string {
  const chain = chainOfChainId(chainId);
  return chain ? CHAIN_DISPLAY[chain].label : String(chainId);
}

/**
 * Where the address stands right now, in one line: how many of the live
 * targets it is a member of, and the chains it is frozen or unreadable on.
 * The count is what tells a Revoke request that needs no action (a member
 * nowhere) from one that does.
 */
function membershipLine(membership: AddressMembership | null): string {
  if (!membership) return 'could not be read';
  const { memberOn, total, unknown } = summarizeMembership(membership);
  const chainsWith = (verdict: 'frozen' | 'unknown') =>
    membership.filter((entry) => entry.verdict === verdict).map(({ target }) => CHAIN_DISPLAY[target.chain].label);
  const parts = [`a member on ${memberOn === 0 ? 'none' : memberOn} of ${total} chains`];
  const frozen = chainsWith('frozen');
  if (frozen.length > 0) parts.push(`frozen on ${frozen.join(', ')}`);
  if (unknown > 0) parts.push(`could not be read on ${chainsWith('unknown').join(', ')}`);
  return parts.join(', ');
}

/**
 * Everything ops needs to act in Centrifuge and nothing more: who (email
 * and id), which address (short for the eye, full to copy) and where it
 * stands on the whitelist now. Neither the chains nor the share class are
 * listed: ops knows the live deployments, and the request is for all of
 * them. Every interpolated value is escaped — the wallet's name and type and
 * the email come from outside.
 */
export function formatWalletLinkOperatorMessage({
  kind,
  record,
  email,
  isSmartAccount,
  membership,
  noDecision,
  otherAccounts
}: {
  kind: WalletLinkOperatorKind;
  record: WalletLinkRecord;
  email: string | null;
  isSmartAccount: boolean;
  membership: AddressMembership | null;
  noDecision: 'declined' | 'revoked' | null;
  otherAccounts: Array<{ email: string; isVerified: boolean }>;
}): string {
  const lines = [
    `<b>${TITLES[kind]}</b>`,
    '',
    // Only a no Decision ends a link; one that moved on before delivery is not named.
    ...(kind === 'revoke_request' ? [`<b>Reason:</b> verification ${noDecision ?? 'no longer approved'}`] : []),
    `<b>User:</b> ${email ? escapeHtml(email) : 'unknown (profile gone)'} (${escapeHtml(record.userId)})`,
    `<b>Address:</b> ${escapeHtml(truncateAddress(record.address))}`,
    `<code>${escapeHtml(record.address)}</code>`,
    `<b>Wallet:</b> ${escapeHtml(record.walletName ?? record.walletType ?? 'unknown')} · signed on ${escapeHtml(chainLabel(record.chainId))}`,
    // A contract is deployed per chain: the same address elsewhere may be nobody's, or someone else's.
    ...(isSmartAccount
      ? [`<b>Smart account:</b> control proven on ${escapeHtml(chainLabel(record.chainId))} only`]
      : []),
    `<b>Whitelist now:</b> ${membershipLine(membership)}`
  ];

  if (kind === 'revoke_request') {
    // The address is not this account's alone: a revoke takes it from everyone
    // who uses it, and a verified one among them is a reason not to.
    const others = otherAccounts
      .slice(0, OTHER_ACCOUNTS_SHOWN)
      .map(({ email: other, isVerified }) => `${escapeHtml(other)} (${isVerified ? 'verified' : 'not verified'})`);
    const more = otherAccounts.length - others.length;
    if (more > 0) others.push(`and ${more} more`);
    lines.push(`<b>Also connected by:</b> ${others.length > 0 ? others.join(', ') : 'no other account'}`);
    lines.push(`<b>Linked since:</b> ${record.signedAt ? record.signedAt.toISOString().slice(0, 10) : 'unknown'}`);
  }

  return lines.join('\n');
}

/** The operator message port over the wallet-link Telegram channel. */
export function createTelegramWalletLinkMessenger({
  sendTelegramMessage,
  chatId
}: {
  sendTelegramMessage: (input: { chatId: string; text: string }) => Promise<unknown>;
  chatId: string;
}): WalletLinkOperatorMessenger {
  return {
    async send({ kind, record, email, isSmartAccount, membership, noDecision, otherAccounts }) {
      await sendTelegramMessage({
        chatId,
        text: formatWalletLinkOperatorMessage({
          kind,
          record,
          email,
          isSmartAccount,
          membership,
          noDecision,
          otherAccounts
        })
      });
    }
  };
}
