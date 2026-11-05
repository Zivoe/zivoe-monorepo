import 'server-only';

import { type VerificationStatus } from '@zivoe/database/kyc';

import { chainOfChainId } from '@/lib/chains';
import { escapeHtml } from '@/lib/utils';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { type WalletLinkOperatorKind, type WalletLinkOperatorMessenger, type WalletLinkRecord } from './wallet-link';
import { type AddressMembership, summarizeMembership } from './wallet-link-membership';

const TITLES: Record<WalletLinkOperatorKind, string> = {
  whitelist_request: '🟢 Whitelist request',
  revoke_request: '🔴 Revoke request'
};

/** Why a Revoke request is asked, by the owner's status; any other reads as no longer approved. */
const REVOKE_REASONS: Partial<Record<VerificationStatus, string>> = {
  declined: 'verification declined',
  revoked: 'verification revoked',
  pending_review: 'verification back under review'
};

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
  const chainsWhere = (holds: (entry: AddressMembership[number]) => boolean) =>
    membership.filter(holds).map(({ target }) => CHAIN_DISPLAY[target.chain].label);
  const parts = [`a member on ${memberOn === 0 ? 'none' : memberOn} of ${total} chains`];
  // A freeze sits beside membership, not instead of it: a frozen member stays in the count.
  const frozen = chainsWhere((entry) => entry.frozen);
  if (frozen.length > 0) parts.push(`frozen on ${frozen.join(', ')}`);
  if (unknown > 0) parts.push(`could not be read on ${chainsWhere((entry) => entry.verdict === 'unknown').join(', ')}`);
  return parts.join(', ');
}

/**
 * Everything ops needs to act in Centrifuge and nothing more: why, who (by
 * email), which address (in full, tap to copy) and where it
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
  endedBy
}: {
  kind: WalletLinkOperatorKind;
  record: WalletLinkRecord;
  email: string | null;
  isSmartAccount: boolean | null;
  membership: AddressMembership | null;
  endedBy: VerificationStatus | null;
}): string {
  // A Linked address is never unlinked: a revoke is a freeze, and the owner
  // approved again is a Whitelist request to lift it, with no new signature.
  // Each request supersedes every lower-numbered one for the address, which
  // ops may not have acted on yet — by number, not by arrival: two lines can
  // land in either order.
  const summary = membership && summarizeMembership(membership);
  // Only when every chain answered: an unread one may still admit the address.
  const revokeAction =
    summary?.memberOn === 0 && summary.unknown === 0
      ? 'a member on no chain when sent, so nothing to freeze unless admitted since'
      : 'freeze on every chain';
  const reason =
    kind === 'whitelist_request'
      ? record.opsRequestVersion > 1
        ? 'approved again; unfreeze where frozen, whitelist where missing'
        : summary?.status === 'whitelisted'
          ? 'new link to an address already whitelisted; nothing to do unless this owner is unexpected'
          : (summary?.frozenOn ?? 0) > 0
            ? 'new link to an address already frozen; check why before unfreezing'
            : 'new link'
      : endedBy === null
        ? `no longer approved when asked, approved again since; ${revokeAction}; a restore request follows unless Chainalysis flags the address`
        : `${REVOKE_REASONS[endedBy] ?? 'verification no longer approved'}; ${revokeAction}`;
  const lines = [
    `<b>${TITLES[kind]} #${record.opsRequestVersion}</b>`,
    '',
    `<b>Reason:</b> ${reason}`,
    ...(record.opsRequestVersion > 1
      ? ['<b>Supersedes:</b> every lower-numbered request for this address; act on the highest number']
      : []),
    `<b>User:</b> ${email ? escapeHtml(email) : 'unknown (profile gone)'}`,
    `<b>Address:</b> <code>${escapeHtml(record.address)}</code>`,
    `<b>Wallet:</b> ${escapeHtml(record.walletName ?? record.walletType ?? 'unknown')} · signed on ${escapeHtml(chainLabel(record.chainId))}`,
    // A contract is deployed per chain: the same address elsewhere may be
    // nobody's, or someone else's. A probe the chain did not answer must not
    // read as "a key's account", so it says so.
    ...(isSmartAccount
      ? [`<b>Smart account:</b> control proven on ${escapeHtml(chainLabel(record.chainId))} only`]
      : isSmartAccount === null
        ? [
            `<b>Smart account:</b> could not be checked; if it is one, control is proven on ${escapeHtml(chainLabel(record.chainId))} only`
          ]
        : []),
    `<b>Whitelist now:</b> ${membershipLine(membership)}`
  ];

  if (kind === 'revoke_request') {
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
    async send({ kind, record, email, isSmartAccount, membership, endedBy }) {
      await sendTelegramMessage({
        chatId,
        text: formatWalletLinkOperatorMessage({
          kind,
          record,
          email,
          isSmartAccount,
          membership,
          endedBy
        })
      });
    }
  };
}
