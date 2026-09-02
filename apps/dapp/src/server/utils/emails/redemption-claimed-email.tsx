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
import { formatEventTimestampUtc, truncateTransactionHash, truncateWalletAddress } from './receipt-formatters';

interface RedemptionClaimedEmailProps {
  sharesAmount: string; // Formatted string, e.g., "1,000.00 zSMB"
  shareSymbol: string;
  assetsAmount: string; // Formatted string, e.g., "1,050.00 USDC"
  assetSymbol: string;
  chainLabel: string;
  walletAddress: string;
  walletExplorerUrl: string | null;
  txHash: string;
  txExplorerUrl: string | null;
  eventTimestampMs: number;
  viewInAppUrl: string;
  unsubscribeUrl?: string;
}

export default function RedemptionClaimedEmail({
  sharesAmount,
  shareSymbol,
  assetsAmount,
  assetSymbol,
  chainLabel,
  walletAddress,
  walletExplorerUrl,
  txHash,
  txExplorerUrl,
  eventTimestampMs,
  viewInAppUrl,
  unsubscribeUrl
}: RedemptionClaimedEmailProps) {
  return (
    <TransactionReceiptLayout preview="Your redemption receipt is ready" unsubscribeUrl={unsubscribeUrl}>
      <Section className="mb-6 text-center" style={{ width: '100%' }}>
        <Heading className="m-0 mb-2 font-heading text-h5 text-primary">Redemption Receipt</Heading>
        <Text className="m-0 text-regular text-secondary">{assetSymbol} has been transferred to your wallet.</Text>
      </Section>

      <ReceiptTokenFlowRow
        from={{ symbol: shareSymbol, value: sharesAmount }}
        to={{ symbol: assetSymbol, value: assetsAmount }}
      />

      <ReceiptDetailTable>
        <ReceiptDetailRow label="Status" value={<ReceiptSuccessBadge />} />
        <ReceiptDetailRow label="Date" value={formatEventTimestampUtc(eventTimestampMs)} />
        <ReceiptDetailRow label="Network" value={chainLabel} />
        <ReceiptDetailRow label="Amount Redeemed" value={sharesAmount} />
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
