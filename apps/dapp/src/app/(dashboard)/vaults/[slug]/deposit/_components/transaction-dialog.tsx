'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useAtom } from 'jotai';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { ArrowRightIcon, CheckCircleIcon, CloseCircleIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { NETWORK_CHAIN } from '@/lib/network';
import { type TransactionTokenSnapshot, transactionAtom } from '@/lib/store';
import { formatBigIntToReadable } from '@/lib/utils';

import { getTokenInfo } from '@/components/token-info';

const EXPLORER_URL = NETWORK_CHAIN.blockExplorers.default.url;

/**
 * Renders exclusively from the payload's token snapshots — never from the
 * ambient page's configuration — so a transaction confirming after navigation
 * to another Zivoe Vault keeps its own labels, amounts, and decimals.
 */
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
              <TransactionDialogToken token={transaction.meta.approve.token} amount={transaction.meta.approve.amount} />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.deposit && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken token={transaction.meta.deposit.asset} amount={transaction.meta.deposit.amount} />

              <ArrowRightIcon className="size-4 text-icon-default" />

              <TransactionDialogToken
                token={transaction.meta.deposit.share}
                amount={transaction.meta.deposit.receive}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.redeem && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken token={transaction.meta.redeem.share} amount={transaction.meta.redeem.amount} />

              {/* The USDC side is an estimate at request time, so it drops out
                  entirely when the Share Price was unavailable — the shares
                  submitted are the fact worth showing either way. */}
              {transaction.meta.redeem.receive !== undefined && (
                <>
                  <ArrowRightIcon className="size-4 text-icon-default" />

                  <TransactionDialogToken
                    token={transaction.meta.redeem.asset}
                    amount={transaction.meta.redeem.receive}
                    prefix="≈ "
                  />
                </>
              )}
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.claimRedeem && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token={transaction.meta.claimRedeem.share}
                amount={transaction.meta.claimRedeem.shares}
              />

              <ArrowRightIcon className="size-4 text-icon-default" />

              <TransactionDialogToken
                token={transaction.meta.claimRedeem.asset}
                amount={transaction.meta.claimRedeem.assets}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.cancelRedeem && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token={transaction.meta.cancelRedeem.share}
                amount={transaction.meta.cancelRedeem.shares}
              />
            </TransactionDialogTokensSection>
          )}

          {transaction.meta?.claimReturnedShares && (
            <TransactionDialogTokensSection>
              <TransactionDialogToken
                token={transaction.meta.claimReturnedShares.share}
                amount={transaction.meta.claimReturnedShares.shares}
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
  prefix
}: {
  token: TransactionTokenSnapshot;
  amount: bigint;
  prefix?: string;
}) {
  const amountFormatted = formatBigIntToReadable(amount, token.decimals);

  return (
    <div className="flex items-center gap-2 [&_svg]:size-6">
      {getTokenInfo(token.symbol)?.icon}

      <p className="text-leading text-primary">
        {prefix}
        {amountFormatted === '0.00' ? '<0.01' : amountFormatted} {token.symbol}
      </p>
    </div>
  );
}
