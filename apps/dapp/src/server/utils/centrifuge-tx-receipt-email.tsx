import 'server-only';

import { type ReactElement } from 'react';

import { formatBigIntWithCommas } from '@/lib/utils';

import { USDC_DISPLAY, buildExplorerLink, resolveChainDisplay } from './centrifuge-tx-alert-message';
import { type TransactionReceiptJob } from './centrifuge-tx-receipt-job';
import TransactionReceiptEmail from './emails/transaction-receipt-email';

/**
 * Presentation half of the Receipt Mailer: a pure map from one receipt job to
 * the email's subject and React element — the renderer beside the Telegram
 * one, sharing its chain-display helpers but nothing HTML-escaped (React
 * escapes text on render). Share identity and URLs arrive resolved: the
 * mailer owns the trust boundary and the env-derived bases, this module owns
 * only what the email says. Copy stays wallet-scoped on purpose — the
 * wallet→account link is self-reported, so a receipt describes activity on
 * "a wallet linked to your account", never "your" transaction.
 */

/** Two-decimal amount with the token's symbol, dust shown as `<0.01`; an absent amount shows a dash. */
function formatTokenAmount({
  value,
  tokenDecimals,
  symbol
}: {
  value: bigint | null;
  tokenDecimals: number;
  symbol: string;
}): string {
  if (value === null) return '—';
  return `${formatBigIntWithCommas({ value, tokenDecimals, displayDecimals: 2, showUnderZero: true })} ${symbol}`;
}

export function buildTransactionReceiptEmail({
  job,
  symbol,
  shareDecimals,
  viewInAppUrl,
  unsubscribeUrl
}: {
  job: TransactionReceiptJob;
  symbol: string;
  shareDecimals: number;
  viewInAppUrl: string;
  unsubscribeUrl: string;
}): { subject: string; email: ReactElement } {
  const { event } = job;

  const chain = resolveChainDisplay(event);
  const common = {
    chainLabel: chain.label,
    walletAddress: event.account,
    walletExplorerUrl: buildExplorerLink({ explorerUrl: chain.explorerUrl, path: `address/${event.account}` }),
    txHash: event.txHash,
    txExplorerUrl: buildExplorerLink({ explorerUrl: chain.explorerUrl, path: `tx/${event.txHash}` }),
    eventTimestampMs: event.createdAtMs,
    unsubscribeUrl
  };

  const sharesAmount = formatTokenAmount({ value: event.tokenAmount, tokenDecimals: shareDecimals, symbol });
  const assetsAmount = formatTokenAmount({
    value: event.currencyAmount,
    tokenDecimals: USDC_DISPLAY.decimals,
    symbol: USDC_DISPLAY.symbol
  });
  const sharesToAssets = {
    from: { symbol, value: sharesAmount },
    to: { symbol: USDC_DISPLAY.symbol, value: assetsAmount }
  };
  // Inbox preview lines lead with the amount when it is known — a dash there
  // reads as a broken email, so an absent amount falls back to a plain line.
  const hasShares = event.tokenAmount !== null;
  const hasAssets = event.currencyAmount !== null;

  // Exhaustive without a default on purpose: a type widened at the boundary
  // but unhandled here fails the build instead of sending a mislabeled email.
  switch (event.type) {
    case 'SYNC_DEPOSIT':
      return {
        subject: `${symbol} Deposit Confirmed`,
        email: (
          <TransactionReceiptEmail
            {...common}
            preview={hasAssets ? `${assetsAmount} deposited into ${symbol}` : 'Your deposit receipt is ready'}
            heading="Deposit Receipt"
            subtitle={`${symbol} has been transferred to a wallet linked to your account.`}
            statusLabel="Success"
            flow={{ from: { symbol: USDC_DISPLAY.symbol, value: assetsAmount }, to: { symbol, value: sharesAmount } }}
            amountLabel="Amount Deposited"
            amountValue={assetsAmount}
            ctaLabel="View In App"
            ctaUrl={viewInAppUrl}
          />
        )
      };

    case 'REDEEM_REQUEST_UPDATED':
      return {
        // The indexer reports the shares added by THIS call, so every on-chain
        // request gets its own "received" email with its own amount.
        subject: `${symbol} Redemption Request Received`,
        email: (
          <TransactionReceiptEmail
            {...common}
            preview={hasShares ? `Request received to redeem ${sharesAmount}` : 'We received your redemption request'}
            heading="Redemption Request Received"
            subtitle={`We received a request to redeem ${symbol} from a wallet linked to your account. We'll email you again when the funds are ready to claim.`}
            statusLabel="Received"
            amountLabel="Amount Requested"
            amountValue={sharesAmount}
            ctaLabel="View In App"
            ctaUrl={viewInAppUrl}
          />
        )
      };

    case 'REDEEM_CLAIMABLE':
      return {
        // One email per fill: a partially approved request legitimately sends
        // this more than once, each naming only the amount that just cleared.
        subject: `Your ${symbol} Redemption Is Ready to Claim`,
        email: (
          <TransactionReceiptEmail
            {...common}
            preview={
              hasAssets ? `${assetsAmount} is ready to claim on ${chain.label}` : 'Your redemption is ready to claim'
            }
            heading="Ready to Claim"
            // The claim is chain-scoped in the app, so the chain is named here
            // — the CTA lands on the vault page, not on a chain.
            subtitle={`A redemption from a wallet linked to your account has been processed. ${USDC_DISPLAY.symbol} is ready to claim in the app on ${chain.label}.`}
            statusLabel="Ready to claim"
            flow={sharesToAssets}
            // Shares the manager approved in this fill — nothing is redeemed
            // until the claim, which the next email confirms.
            amountLabel="Amount Approved"
            amountValue={sharesAmount}
            ctaLabel={`Claim ${USDC_DISPLAY.symbol} in App`}
            // The claim control lives on the redeem tab; ?view= is the page's
            // validated tab selector (and opens the dialog on mobile).
            ctaUrl={`${viewInAppUrl}?view=redeem`}
          />
        )
      };

    case 'REDEEM_CLAIMED':
      return {
        subject: `${symbol} Redemption Complete`,
        email: (
          <TransactionReceiptEmail
            {...common}
            preview={
              hasShares && hasAssets
                ? `${sharesAmount} redeemed for ${assetsAmount}`
                : 'Your redemption receipt is ready'
            }
            heading="Redemption Receipt"
            subtitle={`${USDC_DISPLAY.symbol} has been transferred to a wallet linked to your account.`}
            statusLabel="Success"
            flow={sharesToAssets}
            amountLabel="Amount Redeemed"
            amountValue={sharesAmount}
            ctaLabel="View In App"
            ctaUrl={viewInAppUrl}
          />
        )
      };
  }
}
