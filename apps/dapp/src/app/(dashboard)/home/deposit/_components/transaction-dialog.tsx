'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useAtom } from 'jotai';
import { mainnet } from 'viem/chains';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { ZVltLogo } from '@zivoe/ui/icons';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CloseCircleIcon,
  FrxUsdIcon,
  UsdcIcon,
  UsdtIcon,
  ZsttIcon
} from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { DEPOSIT_TOKEN_DECIMALS, TOKEN_DECIMALS, type Token } from '@/types/constants';

import { transactionAtom } from '@/lib/store';
import { formatBigIntToReadable } from '@/lib/utils';

const EXPLORER_URL = mainnet.blockExplorers.default.url;

const TOKEN_ICON: Record<Token, ReactNode> = {
  USDC: <UsdcIcon />,
  USDT: <UsdtIcon />,
  frxUSD: <FrxUsdIcon />,
  zSTT: <ZsttIcon />,
  zVLT: <ZVltLogo />,
  stSTT: <ZsttIcon />,
  zMCA: <ZVltLogo />
};

export function TransactionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [transaction, setTransaction] = useAtom(transactionAtom);

  const handleOpenChange = (open: boolean) => {
    if (!open) setTransaction(undefined);
    setIsOpen(open);
  };

  useEffect(() => {
    if (transaction) setIsOpen(true);
  }, [transaction]);

  if (!transaction) return null;

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent aria-label={transaction.title} showCloseButton={false}>
        <DialogContentBox className="p-4">
          <div className="flex flex-col items-center gap-6 py-3">
            <div
              className={cn(
                'flex size-12 items-center justify-center rounded-md',
                transaction.type === 'SUCCESS' ? 'bg-element-primary-gentle' : 'bg-element-alert-light'
              )}
            >
              {transaction.type === 'SUCCESS' ? (
                <CheckCircleIcon className="text-primary size-8" />
              ) : (
                <CloseCircleIcon className="text-alert-contrast size-8" />
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <p className="text-h5 text-primary">{transaction.title}</p>
                <p className="text-regular text-secondary text-center">{transaction.description}</p>
              </div>

              <Link size="m" href={`${EXPLORER_URL}/tx/${transaction.hash}`} target="_blank">
                See transaction details
              </Link>
            </div>
          </div>

          {transaction.meta?.approve && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token={transaction.meta.approve.token}
                amount={transaction.meta.approve.amount}
                decimals={TOKEN_DECIMALS[transaction.meta.approve.token]}
                icon={TOKEN_ICON[transaction.meta.approve.token]}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.deposit && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token={transaction.meta.deposit.token}
                amount={transaction.meta.deposit.amount}
                decimals={DEPOSIT_TOKEN_DECIMALS[transaction.meta.deposit.token]}
                icon={TOKEN_ICON[transaction.meta.deposit.token]}
              />

              <ArrowRightIcon className="text-icon-default size-4" />

              <TransactionDialogToken
                token="zVLT"
                amount={transaction.meta.deposit.receive}
                decimals={18}
                icon={<ZVltLogo />}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.redeem && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token="zVLT"
                amount={transaction.meta.redeem.amount}
                decimals={18}
                icon={<ZVltLogo />}
              />

              <ArrowRightIcon className="text-icon-default size-4" />

              <TransactionDialogToken
                token="USDC"
                amount={transaction.meta.redeem.receive}
                decimals={6}
                icon={<UsdcIcon />}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.unstake && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token="stSTT"
                amount={transaction.meta.unstake.amount}
                decimals={18}
                icon={<ZsttIcon />}
              />

              <ArrowRightIcon className="text-icon-default size-4" />

              <TransactionDialogToken
                token="zSTT"
                amount={transaction.meta.unstake.receive}
                decimals={18}
                icon={<ZsttIcon />}
              />
            </TransactionDialogTokensSection>
          )}

          <div className="flex gap-4">
            <Button variant="border-light" fullWidth onPress={() => handleOpenChange(false)}>
              Close
            </Button>

            {transaction.type === 'SUCCESS' && transaction.meta?.unstake && (
              <Link variant="primary" fullWidth href="/" onPress={() => setTransaction(undefined)}>
                Deposit zSTT
              </Link>
            )}
          </div>
        </DialogContentBox>
      </DialogContent>
    </Dialog>
  );
}

function TransactionDialogTokensSection({ children }: { children: ReactNode }) {
  return (
    <div className="border-subtle bg-surface-elevated flex h-14 w-full items-center justify-center gap-4 rounded-md">
      {children}
    </div>
  );
}

function TransactionDialogToken({
  token,
  amount,
  decimals,
  icon
}: {
  token: Token;
  amount: bigint;
  decimals: number;
  icon: ReactNode;
}) {
  const amountFormatted = formatBigIntToReadable(amount, decimals);

  return (
    <div className="flex items-center gap-2 [&_svg]:size-6">
      {icon}

      <p className="text-leading text-primary">
        {amountFormatted === '0.00' ? '<0.01' : amountFormatted} {token}
      </p>
    </div>
  );
}
