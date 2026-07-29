'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useAtom } from 'jotai';
import { mainnet, sepolia } from 'viem/chains';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { ArrowRightIcon, CheckCircleIcon, CloseCircleIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type Token } from '@/types/constants';

import { transactionAtom } from '@/lib/store';
import { formatBigIntToReadable } from '@/lib/utils';

import { TOKEN_INFO } from '@/components/token-info';

import { env } from '@/env';

import { CENTRIFUGE_CONFIG } from '@/centrifuge';

const EXPLORER_URL = (env.NEXT_PUBLIC_NETWORK === 'mainnet' ? mainnet : sepolia).blockExplorers.default.url;

// CENTRIFUGE_CONFIG is the single decimals authority for the vault's tokens —
// a second hardcoded map here is how one leg of a receipt ends up mis-scaled.
const TOKEN_DECIMALS: Record<Token, number> = {
  USDC: CENTRIFUGE_CONFIG.usdc.decimals,
  zMCA: CENTRIFUGE_CONFIG.shareToken.decimals
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
                <CheckCircleIcon className="size-8 text-primary" />
              ) : (
                <CloseCircleIcon className="size-8 text-alert-contrast" />
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <p className="text-h5 text-primary">{transaction.title}</p>
                <p className="text-center text-regular text-secondary">{transaction.description}</p>
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
                icon={TOKEN_INFO[transaction.meta.approve.token].icon}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.deposit && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token={transaction.meta.deposit.token}
                amount={transaction.meta.deposit.amount}
                decimals={TOKEN_DECIMALS[transaction.meta.deposit.token]}
                icon={TOKEN_INFO[transaction.meta.deposit.token].icon}
              />

              <ArrowRightIcon className="size-4 text-icon-default" />

              <TransactionDialogToken
                token="zMCA"
                amount={transaction.meta.deposit.receive}
                decimals={CENTRIFUGE_CONFIG.shareToken.decimals}
                icon={TOKEN_INFO.zMCA.icon}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.redeem && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token="zMCA"
                amount={transaction.meta.redeem.amount}
                decimals={CENTRIFUGE_CONFIG.shareToken.decimals}
                icon={TOKEN_INFO.zMCA.icon}
              />

              <ArrowRightIcon className="size-4 text-icon-default" />

              <TransactionDialogToken
                token="USDC"
                amount={transaction.meta.redeem.receive}
                decimals={CENTRIFUGE_CONFIG.usdc.decimals}
                icon={TOKEN_INFO.USDC.icon}
                prefix="≈ "
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.claimRedeem && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token="zMCA"
                amount={transaction.meta.claimRedeem.shares}
                decimals={CENTRIFUGE_CONFIG.shareToken.decimals}
                icon={TOKEN_INFO.zMCA.icon}
              />

              <ArrowRightIcon className="size-4 text-icon-default" />

              <TransactionDialogToken
                token="USDC"
                amount={transaction.meta.claimRedeem.assets}
                decimals={CENTRIFUGE_CONFIG.usdc.decimals}
                icon={TOKEN_INFO.USDC.icon}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.cancelRedeem && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token="zMCA"
                amount={transaction.meta.cancelRedeem.shares}
                decimals={CENTRIFUGE_CONFIG.shareToken.decimals}
                icon={TOKEN_INFO.zMCA.icon}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.claimReturnedShares && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token="zMCA"
                amount={transaction.meta.claimReturnedShares.shares}
                decimals={CENTRIFUGE_CONFIG.shareToken.decimals}
                icon={TOKEN_INFO.zMCA.icon}
              />
            </TransactionDialogTokensSection>
          )}

          <div className="flex gap-4">
            <Button variant="border-light" fullWidth onPress={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContentBox>
      </DialogContent>
    </Dialog>
  );
}

function TransactionDialogTokensSection({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-14 w-full items-center justify-center gap-4 rounded-md border-subtle bg-surface-elevated">
      {children}
    </div>
  );
}

function TransactionDialogToken({
  token,
  amount,
  decimals,
  icon,
  prefix
}: {
  token: Token;
  amount: bigint;
  decimals: number;
  icon: ReactNode;
  prefix?: string;
}) {
  const amountFormatted = formatBigIntToReadable(amount, decimals);

  return (
    <div className="flex items-center gap-2 [&_svg]:size-6">
      {icon}

      <p className="text-leading text-primary">
        {prefix}
        {amountFormatted === '0.00' ? '<0.01' : amountFormatted} {token}
      </p>
    </div>
  );
}
