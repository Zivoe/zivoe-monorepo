import { atom } from 'jotai';

/**
 * Token identity snapshotted onto the payload at mutation time. The receipt
 * dialog renders exclusively from these — never from the ambient page's
 * configuration — so a transaction confirming after navigation to another
 * Offering keeps its own labels and decimals.
 */
export type TransactionTokenSnapshot = {
  symbol: string;
  decimals: number;
};

export type TransactionData = {
  type: 'SUCCESS' | 'ERROR';
  title: string;
  description: string;
  hash: string;
  /** Stable identity of the Offering transacted on. */
  offeringSlug?: string;
  meta?: {
    approve?: {
      token: TransactionTokenSnapshot;
      amount: bigint;
    };

    deposit?: {
      asset: TransactionTokenSnapshot;
      share: TransactionTokenSnapshot;
      amount: bigint;
      receive: bigint;
    };

    redeem?: {
      share: TransactionTokenSnapshot;
      asset: TransactionTokenSnapshot;
      amount: bigint;
      receive: bigint;
    };

    claimRedeem?: {
      share: TransactionTokenSnapshot;
      asset: TransactionTokenSnapshot;
      /** Exact USDC received. */
      assets: bigint;
      /** Corresponding shares redeemed. */
      shares: bigint;
    };

    cancelRedeem?: {
      share: TransactionTokenSnapshot;
      /** Pending shares the Cancellation covers — snapshot at cancel time; the event carries no amount. */
      shares: bigint;
    };

    claimReturnedShares?: {
      share: TransactionTokenSnapshot;
      /** Exact shares returned to the wallet. */
      shares: bigint;
    };
  };
};

const transactionAtom = atom<TransactionData | undefined>(undefined);

export { transactionAtom };
