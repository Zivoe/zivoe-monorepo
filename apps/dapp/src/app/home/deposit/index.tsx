'use client';

import { useState } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';

import ConnectedAccount from '@/components/connected-account';

import DepositBox from './deposit-box';

export default function Deposit({ indexPrice, apy }: { indexPrice: number; apy: number }) {
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);

  return (
    <>
      <DepositBox indexPrice={indexPrice} apy={apy} className="hidden lg:block lg:min-w-[30rem] xl:min-w-[39.375rem]" />

      <div className="fixed bottom-0 left-0 w-full border border-t border-default bg-surface-base p-4 lg:hidden">
        <ConnectedAccount>
          <Button fullWidth onPress={() => setIsDepositDialogOpen(true)}>
            Deposit
          </Button>
        </ConnectedAccount>
      </div>

      <Dialog isOpen={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
        <DialogContent dialogClassName="gap-0">
          <DialogHeader>
            <DialogTitle>Deposit & Earn</DialogTitle>
          </DialogHeader>

          <DepositBox indexPrice={indexPrice} apy={apy} className="block p-0 lg:hidden" withTitle={false} />
        </DialogContent>
      </Dialog>
    </>
  );
}
