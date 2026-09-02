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

interface RedemptionClaimableEmailProps {
  sharesAmount: string; // Shares this fill redeemed, formatted, e.g., "1,000.00 zSMB"
  shareSymbol: string;
  assetsAmount: string; // Formatted string, e.g., "1,050.00 USDC"
  assetSymbol: string;
  chainLabel: string;
  walletAddress: string;
  walletExplorerUrl: string | null;
  txHash: string;
  txExplorerUrl: string | null;
  eventTimestampMs: number;
  claimUrl: string;
  unsubscribeUrl?: string;
}

export default function RedemptionClaimableEmail({
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
  claimUrl,
  unsubscribeUrl
}: RedemptionClaimableEmailProps) {
  return (
    <TransactionReceiptLayout preview="Your redemption is ready to claim" unsubscribeUrl={unsubscribeUrl}>
      <Section className="mb-6 text-center" style={{ width: '100%' }}>
        <Heading className="m-0 mb-2 font-heading text-h5 text-primary">Ready to Claim</Heading>
        <Text className="m-0 text-regular text-secondary">
          Your redemption has been processed. {assetSymbol} is ready to claim in the app.
        </Text>
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

      <ReceiptCtaButton href={claimUrl} label="Claim in App" />
    </TransactionReceiptLayout>
  );
}
