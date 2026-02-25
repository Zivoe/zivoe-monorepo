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
import { type ReceiptTokenSymbol } from './receipt-config';
import {
  formatEventTimestampUtc,
  getAddressExplorerUrl,
  getTransactionExplorerUrl,
  truncateTransactionHash,
  truncateWalletAddress
} from './receipt-formatters';

interface DepositConfirmationEmailProps {
  inputAmount: string; // Formatted string, e.g., "1,000.00 USDC"
  inputTokenSymbol: ReceiptTokenSymbol;
  sharesReceived: string; // Formatted string, e.g., "950.23 zVLT"
  walletAddress: string;
  txHash: string;
  eventTimestamp: bigint;
}

export default function DepositConfirmationEmail({
  inputAmount,
  inputTokenSymbol,
  sharesReceived,
  walletAddress,
  txHash,
  eventTimestamp
}: DepositConfirmationEmailProps) {
  const formattedTimestamp = formatEventTimestampUtc(eventTimestamp);
  const walletExplorerUrl = getAddressExplorerUrl(walletAddress);
  const transactionExplorerUrl = getTransactionExplorerUrl(txHash);

  return (
    <TransactionReceiptLayout preview="Your deposit receipt is ready">
      <Section className="flex flex-col gap-2">
        <Heading className="mb-2 text-center font-heading text-h5 text-primary">Deposit Receipt</Heading>
        <Text className="text-center text-regular text-secondary">zVLT has been transferred to your wallet.</Text>
      </Section>

      <ReceiptTokenFlowRow
        from={{ symbol: inputTokenSymbol, value: inputAmount }}
        to={{ symbol: 'zVLT', value: sharesReceived }}
      />

      <ReceiptDetailTable>
        <ReceiptDetailRow label="Status" value={<ReceiptSuccessBadge />} />
        <ReceiptDetailRow label="Date" value={formattedTimestamp} />
        <ReceiptDetailRow label="Amount Deposited" value={inputAmount} />
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
