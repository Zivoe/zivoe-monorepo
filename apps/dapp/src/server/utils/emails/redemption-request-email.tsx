import { Heading, Section, Text } from '@react-email/components';

import {
  ReceiptCtaButton,
  ReceiptDetailRow,
  ReceiptDetailTable,
  ReceiptExternalValueLink,
  ReceiptSuccessBadge
} from './components/transaction-receipt-blocks';
import { TransactionReceiptLayout } from './components/transaction-receipt-layout';
import { formatEventTimestampUtc, truncateTransactionHash, truncateWalletAddress } from './receipt-formatters';

interface RedemptionRequestEmailProps {
  sharesAmount: string; // Shares this request added, formatted, e.g., "1,000.00 zSMB"
  shareSymbol: string;
  chainLabel: string;
  walletAddress: string;
  walletExplorerUrl: string | null;
  txHash: string;
  txExplorerUrl: string | null;
  eventTimestampMs: number;
  viewInAppUrl: string;
  unsubscribeUrl?: string;
}

export default function RedemptionRequestEmail({
  sharesAmount,
  shareSymbol,
  chainLabel,
  walletAddress,
  walletExplorerUrl,
  txHash,
  txExplorerUrl,
  eventTimestampMs,
  viewInAppUrl,
  unsubscribeUrl
}: RedemptionRequestEmailProps) {
  return (
    <TransactionReceiptLayout preview="We received your redemption request" unsubscribeUrl={unsubscribeUrl}>
      <Section className="mb-6 text-center" style={{ width: '100%' }}>
        <Heading className="m-0 mb-2 font-heading text-h5 text-primary">Redemption Request Received</Heading>
        <Text className="m-0 text-regular text-secondary">
          We received your request to redeem {shareSymbol}. We&apos;ll email you again when your funds are ready to
          claim.
        </Text>
      </Section>

      <ReceiptDetailTable>
        <ReceiptDetailRow label="Status" value={<ReceiptSuccessBadge />} />
        <ReceiptDetailRow label="Date" value={formatEventTimestampUtc(eventTimestampMs)} />
        <ReceiptDetailRow label="Network" value={chainLabel} />
        <ReceiptDetailRow label="Amount Requested" value={sharesAmount} />
        <ReceiptDetailRow
          label="Wallet"
          value={<ReceiptExternalValueLink href={walletExplorerUrl} text={truncateWalletAddress(walletAddress)} />}
        />
        <ReceiptDetailRow
          label="Transaction Receipt"
          value={<ReceiptExternalValueLink href={txExplorerUrl} text={truncateTransactionHash(txHash)} />}
          withDivider={false}
        />
      </ReceiptDetailTable>

      <ReceiptCtaButton href={viewInAppUrl} />
    </TransactionReceiptLayout>
  );
}
