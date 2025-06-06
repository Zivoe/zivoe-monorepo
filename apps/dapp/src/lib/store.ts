import { atom } from 'jotai';

import { DepositToken } from '@/types/constants';

export type TransactionData = {
  type: 'SUCCESS' | 'ERROR';
  title: string;
  description: string;
  hash: string;
  meta?: {
    deposit?: {
      token: DepositToken;
      amount: bigint;
      receive: bigint;
    };
  };
};

const transactionAtom = atom<TransactionData | undefined>(undefined);

export { transactionAtom };
