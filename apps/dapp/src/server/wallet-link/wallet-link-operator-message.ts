import 'server-only';

import { getShareClassIdentity } from '@zivoe/centrifuge-indexer';

import { ACTIVE_ENVIRONMENT, chainOfChainId } from '@/lib/chains';
import { escapeHtml, truncateAddress } from '@/lib/utils';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { type WalletLinkOperatorKind, type WalletLinkOperatorMessenger, type WalletLinkRecord } from './wallet-link';
import { listMembershipTargets } from './wallet-link-membership';

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
 * Everything ops needs to act in Centrifuge and nothing more: who (email
 * and id), which address (short for the eye, full to copy) and under which
 * pool and share class. The chains are not listed: ops knows the live
 * deployments, and the request is for all of them. Every interpolated value
 * is escaped — the wallet's name and type and the email come from outside.
 */
export function formatWalletLinkOperatorMessage({
  kind,
  record,
  email,
  isSmartAccount,
  noDecision,
  otherAccounts,
  shareClasses
}: {
  kind: WalletLinkOperatorKind;
  record: WalletLinkRecord;
  email: string | null;
  isSmartAccount: boolean;
  noDecision: 'declined' | 'revoked' | null;
  otherAccounts: Array<{ email: string; isVerified: boolean }>;
  shareClasses: Array<{ key: string; poolId: string; scId: string }>;
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
    ...shareClasses.map(
      ({ key, poolId, scId }) =>
        `<b>Share class:</b> ${escapeHtml(key)} (pool ${escapeHtml(poolId)}, scId ${escapeHtml(scId)})`
    )
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

/**
 * The operator message port over the wallet-link Telegram channel. The
 * share classes a request names are those of the deployment's live
 * membership targets — fixed for the life of the process, so they are
 * derived once here rather than on every send.
 */
export function createTelegramWalletLinkMessenger({
  sendTelegramMessage,
  chatId
}: {
  sendTelegramMessage: (input: { chatId: string; text: string }) => Promise<unknown>;
  chatId: string;
}): WalletLinkOperatorMessenger {
  const shareClasses = [...new Set(listMembershipTargets().map(({ shareClassKey }) => shareClassKey))].map((key) => {
    const { poolId, scId } = getShareClassIdentity({ environment: ACTIVE_ENVIRONMENT, key });
    return { key, poolId, scId };
  });

  return {
    async send({ kind, record, email, isSmartAccount, noDecision, otherAccounts }) {
      await sendTelegramMessage({
        chatId,
        text: formatWalletLinkOperatorMessage({
          kind,
          record,
          email,
          isSmartAccount,
          noDecision,
          otherAccounts,
          shareClasses
        })
      });
    }
  };
}
