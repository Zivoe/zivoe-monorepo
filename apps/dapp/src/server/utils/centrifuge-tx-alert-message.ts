import 'server-only';

import { type InvestorTransactionEvent, USDC_DECIMALS, type UsdcInstance } from '@zivoe/centrifuge-indexer';

import { chainOfChainId, getViemChain } from '@/lib/chains';
import { escapeHtml, formatBigIntWithCommas } from '@/lib/utils';

/**
 * Presentation half of the Centrifuge transaction monitor: pure formatters
 * from an indexer event to one Telegram HTML item. Escaping happens at the
 * taint sources — account, chain name, emails, the link — and at the amount
 * formatter, whose dust marker is a literal `<0.01` that Telegram's HTML
 * parser would reject as a tag. Catalog-controlled symbols are trusted.
 * A future email path gets its own renderer beside this one.
 */

/** Longest email list one item may carry — the overflow is counted, bounding item length. */
const MAX_EMAILS_SHOWN = 3;

/**
 * The deposit asset's display shape — identical on every chain (the shared
 * catalog instantiates USDC per chain from one constant), which is what lets
 * the formatter skip per-chain config entirely. If a chain ever carries a
 * divergent instance (USDC.e, other decimals), this must become per-chain
 * again — the test suite pins the uniformity.
 */
export const USDC_DISPLAY: Pick<UsdcInstance, 'symbol' | 'decimals'> = { symbol: 'USDC', decimals: USDC_DECIMALS };

/**
 * "Linked email: a@b.c" line. "Linked" is load-bearing: the wallet↔account
 * binding is self-reported at connect time (no ownership proof), so the line
 * reads as a claim, never as verified investor identity.
 */
export function formatEmailLine(emails: Array<string>): string {
  const unique = [...new Set(emails.map((email) => email.trim()).filter(Boolean))];
  if (unique.length === 0) return 'Linked email: not found';

  const shown = unique.slice(0, MAX_EMAILS_SHOWN).map(escapeHtml);
  const overflow = unique.length - shown.length;

  return `${unique.length === 1 ? 'Linked email' : 'Linked emails'}: ${shown.join(', ')}${overflow > 0 ? ` +${overflow} more` : ''}`;
}

/**
 * Chain label and explorer base for the event. The app's own chain registry
 * wins when the event's chain id is one it knows (the indexer's `network`
 * names are its internal ones — Sepolia reads "ethereum" — and its explorer
 * is null for some chains, Pharos included); otherwise the indexer's values,
 * with the Centrifuge spoke id as the label of last resort.
 */
export function resolveChainDisplay(
  event: Pick<InvestorTransactionEvent, 'chainId' | 'chainName' | 'explorerUrl' | 'centrifugeId'>
): { label: string; explorerUrl: string | null } {
  const chain = event.chainId === null ? undefined : chainOfChainId(event.chainId);
  if (!chain)
    return { label: event.chainName ?? `Centrifuge chain ${event.centrifugeId}`, explorerUrl: event.explorerUrl };

  const viemChain = getViemChain(chain);
  return { label: viemChain.name, explorerUrl: viemChain.blockExplorers?.default.url ?? event.explorerUrl };
}

/** Explorer link for the tx, or null when there is no usable http(s) explorer base. */
export function buildTxLink({ explorerUrl, txHash }: { explorerUrl: string | null; txHash: string }): string | null {
  if (!explorerUrl) return null;

  try {
    const base = new URL(explorerUrl);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
    return new URL(`tx/${txHash}`, base.href.endsWith('/') ? base.href : `${base.href}/`).href;
  } catch {
    return null;
  }
}

/** Two-decimal amount, dust shown as `&lt;0.01` — one dust deposit must not 400 the whole pass. */
function formatAmount({ value, tokenDecimals }: { value: bigint; tokenDecimals: number }): string {
  return escapeHtml(formatBigIntWithCommas({ value, tokenDecimals, displayDecimals: 2, showUnderZero: true }));
}

export function formatTelegramItem({
  event,
  symbol,
  shareDecimals,
  emailLine
}: {
  event: InvestorTransactionEvent;
  symbol: string;
  shareDecimals: number;
  emailLine: string;
}): string {
  const usdc = USDC_DISPLAY;
  const shares =
    event.tokenAmount === null ? '?' : formatAmount({ value: event.tokenAmount, tokenDecimals: shareDecimals });

  // Attribute-safe without quote escaping: URL serialization percent-encodes
  // `"` in every component, and escapeHtml covers `&` — do not reorder them.
  const chain = resolveChainDisplay(event);
  const txLink = buildTxLink({ explorerUrl: chain.explorerUrl, txHash: event.txHash });
  const linkPart = txLink ? `<a href="${escapeHtml(txLink)}">tx</a>` : `Tx: <code>${escapeHtml(event.txHash)}</code>`;
  const chainLine = `Chain: ${escapeHtml(chain.label)} · ${linkPart}`;

  const head = [`Account: <code>${escapeHtml(event.account)}</code>`, emailLine];

  const assets =
    event.currencyAmount === null ? '?' : formatAmount({ value: event.currencyAmount, tokenDecimals: usdc.decimals });

  // Redeem-request rows carry price 0; deposits and executed/claimed
  // redemptions carry the D18 execution price.
  const price =
    event.tokenPrice !== null && event.tokenPrice !== 0n
      ? ` @ ${formatBigIntWithCommas({ value: event.tokenPrice, tokenDecimals: 18, displayDecimals: 4 })}`
      : '';

  // Exhaustive without a default on purpose: with the `string` return type, a
  // type widened at the boundary but unhandled here fails the build instead of
  // falling through to a mislabeled alert.
  switch (event.type) {
    case 'SYNC_DEPOSIT':
      return [
        `<b>Deposit</b> — ${symbol}`,
        ...head,
        `Amount: ${assets} ${usdc.symbol} → ${shares} ${symbol}${price}`,
        chainLine
      ].join('\n');

    case 'REDEEM_REQUEST_UPDATED':
      return [
        `<b>Redemption Request</b> — ${symbol}`,
        ...head,
        // The indexer reports the shares added by THIS call; an increase to an
        // open request correctly shows up as its own alert.
        `Requested: ${shares} ${symbol}`,
        chainLine
      ].join('\n');

    // The manager's approval executed on the spoke (one row per partial fill)
    // vs the investor collecting the assets — same shape, different actor.
    case 'REDEEM_CLAIMABLE':
    case 'REDEEM_CLAIMED':
      return [
        `<b>${event.type === 'REDEEM_CLAIMABLE' ? 'Redemption Claimable' : 'Redemption Claimed'}</b> — ${symbol}`,
        ...head,
        `Amount: ${shares} ${symbol} → ${assets} ${usdc.symbol}${price}`,
        chainLine
      ].join('\n');
  }
}
