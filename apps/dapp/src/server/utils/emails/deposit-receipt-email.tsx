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

interface DepositReceiptEmailProps {
  assetsAmount: string; // Formatted string, e.g., "1,000.00 USDC"
  assetSymbol: string;
  sharesAmount: string; // Formatted string, e.g., "950.23 zSMB"
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

export default function DepositReceiptEmail({
  assetsAmount,
  assetSymbol,
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
}: DepositReceiptEmailProps) {
  return (
    <TransactionReceiptLayout preview="Your deposit receipt is ready" unsubscribeUrl={unsubscribeUrl}>
      <Section className="mb-6 text-center" style={{ width: '100%' }}>
        <Heading className="m-0 mb-2 font-heading text-h5 text-primary">Deposit Receipt</Heading>
        <Text className="m-0 text-regular text-secondary">{shareSymbol} has been transferred to your wallet.</Text>
      </Section>

      <ReceiptTokenFlowRow
        from={{ symbol: assetSymbol, value: assetsAmount }}
        to={{ symbol: shareSymbol, value: sharesAmount }}
      />

      <ReceiptDetailTable>
        <ReceiptDetailRow label="Status" value={<ReceiptSuccessBadge />} />
        <ReceiptDetailRow label="Date" value={formatEventTimestampUtc(eventTimestampMs)} />
        <ReceiptDetailRow label="Network" value={chainLabel} />
        <ReceiptDetailRow label="Amount Deposited" value={assetsAmount} />
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
