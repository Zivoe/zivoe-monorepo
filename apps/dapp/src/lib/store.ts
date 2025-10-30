import { atom } from 'jotai';

import { DepositToken, Token } from '@/types/constants';

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

    unstake?: {
      amount: bigint;
      receive: bigint;
    };
  };
};

const transactionAtom = atom<TransactionData | undefined>(undefined);

const depositDialogAtom = atom<boolean>(false);

const unstakeDialogAtom = atom<boolean>(false);

export { transactionAtom, depositDialogAtom, unstakeDialogAtom };
