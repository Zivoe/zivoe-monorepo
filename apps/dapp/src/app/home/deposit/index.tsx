'use client';

import { useAtom } from 'jotai';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';

import { depositDialogAtom } from '@/lib/store';

import { useAccount } from '@/hooks/useAccount';

import ConnectedAccount from '@/components/connected-account';

import DepositBox from './deposit-box';

export default function Deposit({ apy }: { apy: number }) {
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useAtom(depositDialogAtom);
  const { isPending, address } = useAccount();

  return (
    <>
      <DepositBox apy={apy} className="hidden lg:block lg:min-w-[30rem] xl:min-w-[39.375rem]" />

      <div className="fixed bottom-0 left-0 w-full border border-t border-default bg-surface-base p-4 lg:hidden">
        {isPending ? 'isPending' : 'isNotPending'}
        {address ? 'isConnected' : 'isNotConnected'}
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

          <DepositBox apy={apy} className="block p-0 lg:hidden" withTitle={false} boxClassName="p-4" />
        </DialogContent>
      </Dialog>
    </>
  );
}
