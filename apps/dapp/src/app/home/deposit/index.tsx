'use client';

import { useAtom } from 'jotai';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Tab, TabList, TabPanel, Tabs } from '@zivoe/ui/core/tabs';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { depositDialogAtom } from '@/lib/store';

import ConnectedAccount from '@/components/connected-account';

import { TransactionDialog } from './_components/transaction-dialog';
import { DepositFlow } from './deposit-flow';
import RedeemFlow from './redeem-flow';

export default function Deposit({ apy }: { apy: number | null }) {
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useAtom(depositDialogAtom);

  return (
    <>
      <EarnBox apy={apy} className="hidden lg:block lg:min-w-[30rem] xl:min-w-[39.375rem]" />

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

          <EarnBox apy={apy} className="block p-0 lg:hidden" withTitle={false} boxClassName="p-4" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function EarnBox({
  apy,
  className,
  withTitle = true,
  boxClassName
}: {
  apy: number | null;
  className?: string;
  withTitle?: boolean;
  boxClassName?: string;
}) {
  return (
    <div
      className={cn(
        'sticky top-14 hidden rounded-2xl bg-surface-elevated p-2 lg:block lg:min-w-[30rem] xl:min-w-[39.375rem]',
        className
      )}
    >
      {withTitle && (
        <div className="p-4">
          <p className="text-h6 text-primary">Deposit & Earn</p>
        </div>
      )}

      <DialogContentBox className={boxClassName}>
        <Tabs defaultSelectedKey="deposit">
          <TabList aria-label="Deposit and Redeem tabs">
            <Tab id="deposit">Deposit</Tab>
            <Tab id="redeem">Redeem</Tab>
          </TabList>

          <TabPanel id="deposit">
            <DepositFlow apy={apy} />
          </TabPanel>

          <TabPanel id="redeem">
            <RedeemFlow />
          </TabPanel>
        </Tabs>
      </DialogContentBox>

      <TransactionDialog />
    </div>
  );
}
