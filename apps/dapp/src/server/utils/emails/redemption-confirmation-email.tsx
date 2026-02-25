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
import {
  formatEventTimestampUtc,
  getAddressExplorerUrl,
  getTransactionExplorerUrl,
  truncateTransactionHash,
  truncateWalletAddress
} from './receipt-formatters';

interface RedemptionConfirmationEmailProps {
  zVLTRedeemed: string; // Formatted string, e.g., "1,000.00 zVLT"
  usdcReceived: string; // Formatted string, e.g., "1,050.00 USDC"
  fee: string; // Formatted string, e.g., "10.50 USDC"
  walletAddress: string;
  txHash: string;
  eventTimestamp: bigint;
}

export default function RedemptionConfirmationEmail({
  zVLTRedeemed,
  usdcReceived,
  fee,
  walletAddress,
  txHash,
  eventTimestamp
}: RedemptionConfirmationEmailProps) {
  const formattedTimestamp = formatEventTimestampUtc(eventTimestamp);
  const walletExplorerUrl = getAddressExplorerUrl(walletAddress);
  const transactionExplorerUrl = getTransactionExplorerUrl(txHash);

  return (
    <TransactionReceiptLayout preview="Your redemption receipt is ready">
      <Section className="flex flex-col gap-2">
        <Heading className="mb-2 text-center font-heading text-h5 text-primary">Redemption Receipt</Heading>
        <Text className="text-center text-regular text-secondary">USDC has been transferred to your wallet.</Text>
      </Section>

      <ReceiptTokenFlowRow
        from={{ symbol: 'zVLT', value: zVLTRedeemed }}
        to={{ symbol: 'USDC', value: usdcReceived }}
      />

      <ReceiptDetailTable>
        <ReceiptDetailRow label="Status" value={<ReceiptSuccessBadge />} />
        <ReceiptDetailRow label="Date" value={formattedTimestamp} />
        <ReceiptDetailRow label="Amount Redeemed" value={zVLTRedeemed} />
        <ReceiptDetailRow label="Fee" value={fee} />
        <ReceiptDetailRow
          label="Wallet"
          value={<ReceiptExternalValueLink href={walletExplorerUrl} text={truncateWalletAddress(walletAddress)} />}
        />
        <ReceiptDetailRow
          label="Transaction Receipt"
          value={<ReceiptExternalValueLink href={transactionExplorerUrl} text={truncateTransactionHash(txHash)} />}
          withDivider={false}
        />
      </ReceiptDetailTable>

      <ReceiptCtaButton />
    </TransactionReceiptLayout>
  );
}
