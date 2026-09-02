import { Heading, Section, Text } from '@react-email/components';

import {
  ReceiptCtaButton,
  ReceiptDetailRow,
  ReceiptDetailTable,
  ReceiptExternalValueLink,
  ReceiptSuccessBadge,
  ReceiptTokenFlowRow
} from './components/transaction-receipt-blocks';
import { TransactionReceiptLayout } from './components/transaction-receipt-layout';
import { formatEventTimestampUtc, truncateMiddle } from './receipt-formatters';

type ReceiptFlow = {
  from: { symbol: string; value: string };
  to: { symbol: string; value: string };
};

/**
 * The one receipt template: every event type is this same chrome — heading,
 * optional token-flow row, the six-row detail table, one CTA — differing only
 * in strings and the flow direction, all supplied by the renderer's per-type
 * switch (centrifuge-tx-receipt-email). Keeping a single component means a
 * detail-table change is one edit, not four drifting copies.
 */
interface TransactionReceiptEmailProps {
  preview: string;
  heading: string;
  subtitle: string;
  /** Omitted when the event has no asset leg yet (a redemption request). */
  flow?: ReceiptFlow;
  amountLabel: string;
  amountValue: string; // Formatted string, e.g., "1,000.00 USDC"
  ctaLabel: string;
  ctaUrl: string;
  chainLabel: string;
  walletAddress: string;
  walletExplorerUrl: string | null;
  txHash: string;
  txExplorerUrl: string | null;
  eventTimestampMs: number;
  unsubscribeUrl: string;
}

export default function TransactionReceiptEmail({
  preview,
  heading,
  subtitle,
  flow,
  amountLabel,
  amountValue,
  ctaLabel,
  ctaUrl,
  chainLabel,
  walletAddress,
  walletExplorerUrl,
  txHash,
  txExplorerUrl,
  eventTimestampMs,
  unsubscribeUrl
}: TransactionReceiptEmailProps) {
  return (
    <TransactionReceiptLayout preview={preview} unsubscribeUrl={unsubscribeUrl}>
      <Section className="mb-6 text-center" style={{ width: '100%' }}>
        <Heading className="m-0 mb-2 font-heading text-h5 text-primary">{heading}</Heading>
        <Text className="m-0 text-regular text-secondary">{subtitle}</Text>
      </Section>

      {flow ? <ReceiptTokenFlowRow from={flow.from} to={flow.to} /> : null}

      <ReceiptDetailTable>
        <ReceiptDetailRow label="Status" value={<ReceiptSuccessBadge />} />
        <ReceiptDetailRow label="Date" value={formatEventTimestampUtc(eventTimestampMs)} />
        <ReceiptDetailRow label="Network" value={chainLabel} />
        <ReceiptDetailRow label={amountLabel} value={amountValue} />
        <ReceiptDetailRow
          label="Wallet"
          value={<ReceiptExternalValueLink href={walletExplorerUrl} text={truncateMiddle(walletAddress)} />}
        />
        <ReceiptDetailRow
          label="Transaction Receipt"
          value={<ReceiptExternalValueLink href={txExplorerUrl} text={truncateMiddle(txHash)} />}
          withDivider={false}
        />
      </ReceiptDetailTable>

      <ReceiptCtaButton href={ctaUrl} label={ctaLabel} />
    </TransactionReceiptLayout>
  );
}
