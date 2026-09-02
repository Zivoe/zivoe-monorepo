import 'server-only';

import { type ReactElement } from 'react';

import { formatBigIntWithCommas } from '@/lib/utils';

import { USDC_DISPLAY, buildExplorerLink, resolveChainDisplay } from './centrifuge-tx-alert-message';
import { type TransactionReceiptJob } from './centrifuge-tx-receipt-job';
import DepositReceiptEmail from './emails/deposit-receipt-email';
import RedemptionClaimableEmail from './emails/redemption-claimable-email';
import RedemptionClaimedEmail from './emails/redemption-claimed-email';
import RedemptionRequestEmail from './emails/redemption-request-email';

/**
 * Presentation half of the Receipt Mailer: a pure map from one receipt job to
 * the email's subject and React element — the renderer beside the Telegram
 * one, sharing its chain-display helpers but nothing HTML-escaped (React
 * escapes text on render). Share identity and URLs arrive resolved: the
 * mailer owns the trust boundary and the env-derived bases, this module owns
 * only what the email says.
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
  const usdc = USDC_DISPLAY;

  const chain = resolveChainDisplay(event);
  const common = {
    shareSymbol: symbol,
    assetSymbol: usdc.symbol,
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
    tokenDecimals: usdc.decimals,
    symbol: usdc.symbol
  });

  // Exhaustive without a default on purpose: a type widened at the boundary
  // but unhandled here fails the build instead of sending a mislabeled email.
  switch (event.type) {
    case 'SYNC_DEPOSIT':
      return {
        subject: 'Deposit Confirmed',
        email: (
          <DepositReceiptEmail
            {...common}
            assetsAmount={assetsAmount}
            sharesAmount={sharesAmount}
            viewInAppUrl={viewInAppUrl}
          />
        )
      };

    case 'REDEEM_REQUEST_UPDATED':
      return {
        // The indexer reports the shares added by THIS call, so every on-chain
        // request gets its own "received" email with its own amount.
        subject: 'Redemption Request Received',
        email: <RedemptionRequestEmail {...common} sharesAmount={sharesAmount} viewInAppUrl={viewInAppUrl} />
      };

    case 'REDEEM_CLAIMABLE':
      return {
        // One email per fill: a partially approved request legitimately sends
        // this more than once, each naming only the amount that just cleared.
        subject: 'Your Redemption Is Ready to Claim',
        email: (
          <RedemptionClaimableEmail
            {...common}
            sharesAmount={sharesAmount}
            assetsAmount={assetsAmount}
            // The claim control lives on the redeem tab; ?view= is the page's
            // validated tab selector (and opens the dialog on mobile).
            claimUrl={`${viewInAppUrl}?view=redeem`}
          />
        )
      };

    case 'REDEEM_CLAIMED':
      return {
        subject: 'Redemption Complete',
        email: (
          <RedemptionClaimedEmail
            {...common}
            sharesAmount={sharesAmount}
            assetsAmount={assetsAmount}
            viewInAppUrl={viewInAppUrl}
          />
        )
      };
  }
}
