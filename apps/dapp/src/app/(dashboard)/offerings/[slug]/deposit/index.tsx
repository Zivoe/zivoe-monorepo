'use client';

import { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useAtom, useSetAtom } from 'jotai';
import { type Key } from 'react-aria-components';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Tab, TabList, TabPanel, Tabs } from '@zivoe/ui/core/tabs';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { depositDialogAtom } from '@/lib/store';

import ConnectedAccount from '@/components/connected-account';

import { TransactionDialog } from './_components/transaction-dialog';
import { useTabNavigation } from './_hooks/useTabNavigation';
import { type DepositPageTab, type DepositPageView, depositPageTabSchema, depositPageViewSchema } from './_utils';
import { DepositFlow } from './deposit-flow';
import RedeemFlow from './redeem-flow';

export default function Deposit({ initialView }: { initialView: DepositPageView }) {
  const { navigateToTab } = useTabNavigation();
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useAtom(depositDialogAtom);

  return (
    <>
      <EarnBox initialView={initialView} className="hidden lg:block lg:min-w-120 xl:min-w-157.5" />

      <div className="fixed bottom-0 left-0 w-full border border-t border-default bg-surface-base p-4 lg:hidden">
        <ConnectedAccount>
          <div className="flex gap-2">
            <Button fullWidth onPress={() => navigateToTab('deposit')}>
              Deposit
            </Button>

            <Button fullWidth variant="primary-light" onPress={() => navigateToTab('redeem')}>
              Redeem
            </Button>
          </div>
        </ConnectedAccount>
      </div>

      <Dialog isOpen={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
        <DialogContent dialogClassName="gap-0" showCloseButton={false}>
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle>Earn</DialogTitle>
          </DialogHeader>

          <EarnBox initialView={initialView} className="block p-0 lg:hidden" withTitle={false} boxClassName="p-4" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function EarnBox({
  initialView,
  className,
  withTitle = true,
  boxClassName
}: {
  initialView: DepositPageView;
  className?: string;
  withTitle?: boolean;
  boxClassName?: string;
}) {
  const searchParams = useSearchParams();
  const { updateTab, isMobile } = useTabNavigation();
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const [selectedTab, setSelectedTab] = useState<DepositPageTab>(() => initialView ?? 'deposit');

  useEffect(() => {
    const view = searchParams.get('view');
    const viewParsed = depositPageViewSchema.safeParse(view);
    if (viewParsed.success) {
      setSelectedTab(viewParsed.data ?? 'deposit');
      if (isMobile && viewParsed.data) setIsDepositDialogOpen(true);
    }
  }, [searchParams, isMobile, setIsDepositDialogOpen]);

  const handleTabChange = (key: Key) => {
    const tabKey = depositPageTabSchema.safeParse(key);
    if (!tabKey.success) return;

    setSelectedTab(tabKey.data);
    updateTab(tabKey.data);
  };

  return (
    <div className={cn('sticky top-14 hidden lg:block lg:min-w-120 xl:min-w-157.5', className)}>
      <div className="rounded-2xl bg-surface-elevated p-2">
        {withTitle && (
          <div className="p-4">
            <p className="text-h6 text-primary">Earn</p>
          </div>
        )}

        <DialogContentBox className={boxClassName}>
          <Tabs selectedKey={selectedTab} onSelectionChange={handleTabChange}>
            <TabList aria-label="Deposit and Redeem tabs">
              <Tab id="deposit">Deposit</Tab>
              <Tab id="redeem">Redeem</Tab>
            </TabList>

            <TabPanel id="deposit">
              <DepositFlow />
            </TabPanel>

            <TabPanel id="redeem">
              <RedeemFlow />
            </TabPanel>
          </Tabs>
        </DialogContentBox>

        <TransactionDialog />
      </div>
    </div>
  );
}
