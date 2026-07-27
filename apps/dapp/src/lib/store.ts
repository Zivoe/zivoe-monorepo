import { atom } from 'jotai';

import { type DepositToken, type Token } from '@/types/constants';

export type TransactionData = {
  type: 'SUCCESS' | 'ERROR';
  title: string;
  description: string;
  hash: string;
  meta?: {
    approve?: {
      token: Token;
      amount: bigint;
    };

    deposit?: {
      token: DepositToken;
      amount: bigint;
      receive: bigint;
    };

    redeem?: {
      amount: bigint;
      receive: bigint;
    };

    claimRedeem?: {
      /** Exact USDC received. */
      assets: bigint;
      /** Corresponding zMCA redeemed. */
      shares: bigint;
    };

    cancelRedeem?: {
      /** Pending zMCA the Cancellation covers — snapshot at cancel time; the event carries no amount. */
      shares: bigint;
    };

    claimReturnedShares?: {
      /** Exact zMCA returned to the wallet. */
      shares: bigint;
    };
  };
};

const transactionAtom = atom<TransactionData | undefined>(undefined);

const depositDialogAtom = atom<boolean>(false);

const unstakeDialogAtom = atom<boolean>(false);

export { transactionAtom, depositDialogAtom, unstakeDialogAtom };
