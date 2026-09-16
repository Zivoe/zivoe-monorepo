'use client';

import { useEffect, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { type Key } from 'react-aria-components';

import { Button } from '@zivoe/ui/core/button';
import { DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Tab, TabList, TabPanel, Tabs } from '@zivoe/ui/core/tabs';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useAccount } from '@/hooks/useAccount';

import ConnectedAccount from '@/components/connected-account';

import { TransactionDialog } from './_components/transaction-dialog';
import { EarnDialogProvider, useEarnDialog } from './_hooks/earn-dialog';
import { useRedemptionRequests } from './_hooks/use-redemption-requests';
import { useTabNavigation } from './_hooks/useTabNavigation';
import { type DepositPageTab, type DepositPageView, depositPageTabSchema, depositPageViewSchema } from './_utils';
import { DepositFlow } from './deposit-flow';
import RedeemFlow from './redeem-flow';
import PendingFlow from './pending-flow';

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
  const account = useAccount();

  // A wallet that disconnects while the dialog is open (from the wallet app)
  // would leave it showing a Connect Wallet whose sheet the modal makes inert.
  useEffect(() => {
    if (account.isDisconnected) setIsEarnDialogOpen(false);
  }, [account.isDisconnected, setIsEarnDialogOpen]);

  return (
    <>
      <EarnBox initialView={initialView} className="hidden lg:block lg:min-w-120 xl:min-w-157.5" />

      <div className="fixed bottom-0 left-0 w-full border border-t border-default bg-surface-base p-4 lg:hidden">
        <ConnectedAccount>
          <div className="flex gap-2">
            <Button fullWidth onPress={() => navigateToTab('deposit')}>
              Deposit
            </Button>

            <Button fullWidth variant="primary-light" className="relative" onPress={() => navigateToTab('redeem')}>
              Redeem
              <PendingCountBadge />
            </Button>
          </div>
        </ConnectedAccount>
      </div>

      <DialogContent
        isOpen={isEarnDialogOpen}
        onOpenChange={setIsEarnDialogOpen}
        dialogClassName="gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>Earn</DialogTitle>
        </DialogHeader>

        <EarnBox initialView={initialView} className="block p-0 lg:hidden" withTitle={false} boxClassName="p-4" />
      </DialogContent>
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
  const account = useAccount();

  const [selectedTab, setSelectedTab] = useState<DepositPageTab>(() => initialView ?? 'deposit');

  // A mobile deep link opens the Earn dialog only once a wallet is connected:
  // opened over a disconnected page, the modal marks the wallet-connect sheet
  // inert, so its wallet list shows but ignores every tap. The link is
  // honoured once (the URL keeps `?view=` after in-dialog tab changes, and a
  // later wallet switch must not pop the dialog again).
  const openedForRef = useRef<string>(undefined);
  useEffect(() => {
    const viewParsed = depositPageViewSchema.safeParse(searchParams.get('view'));
    if (!viewParsed.success) return;
    setSelectedTab(viewParsed.data ?? 'deposit');

    if (!isMobile || !viewParsed.data || !account.address) return;
    const link = searchParams.toString();
    if (openedForRef.current === link) return;
    openedForRef.current = link;
    setIsEarnDialogOpen(true);
  }, [searchParams, isMobile, account.address, setIsEarnDialogOpen]);

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
            {/* Three tabs and the badge outgrow the tab list on phones: 244px
                of text and padding against 240px at 320px wide. Tighter tab
                padding below sm buys the room. */}
            <TabList aria-label="Deposit, Redeem and Pending tabs">
              <Tab id="deposit" className="px-2 sm:px-4">
                Deposit
              </Tab>
              <Tab id="redeem" className="px-2 sm:px-4">
                Redeem
              </Tab>
              <Tab id="pending" className="relative px-2 sm:px-4">
                Pending
                <PendingCountBadge />
              </Tab>
            </TabList>

            <TabPanel id="deposit">
              <DepositFlow />
            </TabPanel>

            <TabPanel id="redeem">
              <RedeemFlow />
            </TabPanel>

            <TabPanel id="pending">
              <PendingFlow />
            </TabPanel>
          </Tabs>
        </DialogContentBox>

        <TransactionDialog />
      </div>
    </div>
  );
}

/**
 * How many rows the Pending tab holds, on the tab itself and on the mobile
 * bar's Redeem button. Nothing while there are none.
 */
function PendingCountBadge() {
  const { count } = useRedemptionRequests();
  if (count === 0) return null;

  // The digit is visual; assistive tech reads the sentence, joined onto the
  // host's own label ("Pending (3 requests pending)"). Below 360px the pill
  // has no room beside three tabs, so it floats over the host's top-right
  // corner instead of taking width (the hosts are `relative`).
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute -top-1.5 -right-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-element-primary px-1.5 text-extraSmall font-semibold text-base tabular-nums min-[360px]:static min-[360px]:ml-1.5"
      >
        {count}
      </span>
      <span className="sr-only">{`(${String(count)} ${count === 1 ? 'request' : 'requests'} pending)`}</span>
    </>
  );
}
