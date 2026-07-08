import { type ReactNode, Suspense } from 'react';

import { DynamicUserProfile } from '@dynamic-labs/sdk-react-core';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import NavigationMobileDialog from '@zivoe/ui/components/navigation-mobile-dialog';
import { Button } from '@zivoe/ui/core/button';
import { Dialog } from '@zivoe/ui/core/dialog';
import { NextLink } from '@zivoe/ui/core/link';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { HamburgerIcon } from '@zivoe/ui/icons';

import { getUserMenuData } from '@/server/data/auth';

import ChainalysisAssessmentDialog from '@/app/(dashboard)/_components/chainalysis-assessment-dialog';
import Footer from '@/app/(dashboard)/_components/footer';

import { NavigationItems, UserMenu, Wallet } from './_components/layout';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />

      <div className="bg-surface-base flex h-full flex-col justify-between">
        {children}
        <Footer />
      </div>

      <ChainalysisAssessmentDialog />
    </>
  );
}

function Header() {
  return (
    <>
      <div className="bg-surface-base flex min-h-[6.25rem] w-full items-center justify-between px-4 lg:px-10">
        <div className="flex items-center gap-10">
          <NextLink href="/" aria-label="Zivoe home">
            <ZivoeLogo aria-hidden="true" className="-ml-3 h-6" />
          </NextLink>

          <DesktopNavigation />
        </div>

        <div className="flex items-center gap-2">
          <Wallet />

          <Suspense fallback={<Skeleton className="size-12 rounded-[4px]" />}>
            <UserMenuWrapper />
          </Suspense>

          <MobileNavigation />
        </div>
      </div>

      <DynamicUserProfile />
    </>
  );
}

async function UserMenuWrapper() {
  const user = await getUserMenuData();
  return <UserMenu user={user} />;
}

function DesktopNavigation() {
  return (
    <div className="hidden gap-6 lg:flex">
      <NavigationItems />
    </div>
  );
}

function MobileNavigation() {
  return (
    <Dialog>
      <Button aria-label="Open navigation menu" variant="border-light" className="lg:hidden">
        <HamburgerIcon aria-hidden="true" />
      </Button>

      <NavigationMobileDialog>
        <NavigationItems />
      </NavigationMobileDialog>
    </Dialog>
  );
}
