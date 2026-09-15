'use client';

import { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { type Key } from 'react-aria-components';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Tab, TabList, TabPanel, Tabs } from '@zivoe/ui/core/tabs';
import { cn } from '@zivoe/ui/lib/tw-utils';

import ConnectedAccount from '@/components/connected-account';

import { TransactionDialog } from './_components/transaction-dialog';
import { EarnDialogProvider, useEarnDialog } from './_hooks/earn-dialog';
import { useRedemptionRequests } from './_hooks/use-redemption-requests';
import { useTabNavigation } from './_hooks/useTabNavigation';
import { type DepositPageTab, type DepositPageView, depositPageTabSchema, depositPageViewSchema } from './_utils';
import { DepositFlow } from './deposit-flow';
import RedeemFlow from './redeem-flow';
import RequestsFlow from './requests-flow';

export default function Deposit({ initialView }: { initialView: DepositPageView }) {
  return (
    <EarnDialogProvider>
      <DepositContent initialView={initialView} />
    </EarnDialogProvider>
  );
}

function DepositContent({ initialView }: { initialView: DepositPageView }) {
  const { navigateToTab } = useTabNavigation();
  const { isOpen: isEarnDialogOpen, setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

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
              <RequestsCountBadge />
            </Button>
          </div>
        </ConnectedAccount>
      </div>

      <Dialog isOpen={isEarnDialogOpen} onOpenChange={setIsEarnDialogOpen}>
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
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

  const [selectedTab, setSelectedTab] = useState<DepositPageTab>(() => initialView ?? 'deposit');

  useEffect(() => {
    const view = searchParams.get('view');
    const viewParsed = depositPageViewSchema.safeParse(view);
    if (viewParsed.success) {
      setSelectedTab(viewParsed.data ?? 'deposit');
      if (isMobile && viewParsed.data) setIsEarnDialogOpen(true);
    }
  }, [searchParams, isMobile, setIsEarnDialogOpen]);

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
            <TabList aria-label="Deposit, Redeem and Requests tabs">
              <Tab id="deposit">Deposit</Tab>
              <Tab id="redeem">Redeem</Tab>
              <Tab id="requests">
                Requests
                <RequestsCountBadge />
              </Tab>
            </TabList>

            <TabPanel id="deposit">
              <DepositFlow />
            </TabPanel>

            <TabPanel id="redeem">
              <RedeemFlow />
            </TabPanel>

            <TabPanel id="requests">
              <RequestsFlow />
            </TabPanel>
          </Tabs>
        </DialogContentBox>

        <TransactionDialog />
      </div>
    </div>
  );
}

/**
 * How many rows the Requests tab holds, on the tab itself and on the mobile
 * bar's Redeem button. Nothing while there are none.
 */
function RequestsCountBadge() {
  const { count } = useRedemptionRequests();
  if (count === 0) return null;

  // The digit is visual; assistive tech reads the sentence, joined onto the
  // host's own label ("Requests (3 requests pending)").
  return (
    <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-element-primary px-1.5 text-extraSmall font-semibold text-base tabular-nums">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{`(${String(count)} ${count === 1 ? 'request' : 'requests'} pending)`}</span>
    </span>
  );
}
