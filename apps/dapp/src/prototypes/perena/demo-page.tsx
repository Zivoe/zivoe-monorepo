'use client';

import { useEffect, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useMediaQuery } from 'react-responsive';

import { Button } from '@zivoe/ui/core/button';
import { DialogContent, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { ArrowLeftIcon } from '@zivoe/ui/icons';

import Container from '@/components/container';
import Page from '@/components/page';

import { PERENA_DEMO_NOTICE, PERENA_DEMO_PATH } from './config';
import { DemoInfo } from './demo-info';
import { DemoIdentity } from './identity';
import { type DemoTab } from './state';
import { TransactionPanel } from './transaction-panel';
import { useDemoSession } from './use-demo-session';

export function PerenaDemoPage({ initialTab }: { initialTab: DemoTab }) {
  const searchParams = useSearchParams();
  const matchesDesktop = useMediaQuery({ query: '(min-width: 1024px)' });
  const { state, dispatch, ready, storageUnavailable } = useDemoSession(initialTab);
  // The server cannot know the viewport. Match its first render before choosing a panel.
  const isDesktop = ready && matchesDesktop;
  const [dialogOpen, setDialogOpen] = useState(false);
  const lastView = useRef<string | null>(null);
  const view = searchParams.get('view');

  useEffect(() => {
    if (view !== 'deposit' && view !== 'redeem') {
      lastView.current = null;
      return;
    }
    if (!ready || lastView.current === view || state.stage === 'processing') return;
    lastView.current = view;
    if (state.tab !== view) dispatch({ type: 'tab', tab: view });
    if (!isDesktop) setDialogOpen(true);
  }, [view, ready, isDesktop, state.tab, state.stage, dispatch]);

  // A viewport change must not leave a modal over the desktop panel.
  useEffect(() => {
    if (isDesktop) setDialogOpen(false);
  }, [isDesktop]);

  function changeTab(tab: DemoTab) {
    if (state.stage === 'processing') return;
    if (state.tab !== tab) dispatch({ type: 'tab', tab });
    lastView.current = tab;
    window.history.pushState(null, '', `${PERENA_DEMO_PATH}?view=${tab}`);
    if (!isDesktop) setDialogOpen(true);
  }

  const panel = (
    <TransactionPanel state={state} dispatch={dispatch} ready={ready} onTabChange={changeTab} withTitle={isDesktop} />
  );

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 border-y border-default bg-element-primary-light py-3">
        <Container>
          <p className="text-small font-medium text-brand">{PERENA_DEMO_NOTICE}</p>
        </Container>
      </div>
      <Container>
        <div className="w-full pt-7">
          <Link href="/" variant="ghost" size="s" className="-ml-3">
            <ArrowLeftIcon /> Back
          </Link>
          <div className="pt-5.5 pb-1">
            <DemoIdentity heading />
          </div>
        </div>
      </Container>
      <Page className="mt-10 gap-10 pb-24 lg:mt-12 lg:flex-row lg:pb-0">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {storageUnavailable && (
            <p role="status" className="text-small text-secondary">
              Session storage is unavailable. You can still explore; balances will reset when you reload.
            </p>
          )}
          <DemoInfo activity={state.activity} />
        </div>
        {isDesktop && (
          <aside aria-label="Demo transactions" className="sticky top-20 w-120 shrink-0 xl:w-157.5">
            {panel}
          </aside>
        )}
      </Page>
      {!isDesktop && (
        <>
          <div className="fixed bottom-0 left-0 z-30 flex w-full gap-2 border-t border-default bg-surface-base p-4">
            <Button fullWidth onPress={() => changeTab('deposit')} isDisabled={state.stage === 'processing'}>
              Deposit
            </Button>
            <Button
              fullWidth
              variant="primary-light"
              onPress={() => changeTab('redeem')}
              isDisabled={state.stage === 'processing'}
            >
              Redeem
            </Button>
          </div>
          <DialogContent
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
            isDismissable={state.stage !== 'processing'}
            dialogClassName="gap-0"
          >
            <DialogHeader>
              <DialogTitle>Earn</DialogTitle>
            </DialogHeader>
            {panel}
          </DialogContent>
        </>
      )}
    </div>
  );
}
