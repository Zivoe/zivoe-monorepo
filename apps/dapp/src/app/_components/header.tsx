'use client';

import * as React from 'react';

import { usePathname } from 'next/navigation';

import { DynamicUserProfile, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { WalletIcon } from '@dynamic-labs/wallet-book';
import { OverlayTriggerStateContext } from 'react-aria-components';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import NavigationMobileDialog from '@zivoe/ui/components/navigation-mobile-dialog';
import { Button } from '@zivoe/ui/core/button';
import { Dialog } from '@zivoe/ui/core/dialog';
import { NextLink } from '@zivoe/ui/core/link';
import { Link } from '@zivoe/ui/core/link';
import { HamburgerIcon } from '@zivoe/ui/icons';

import { truncateAddress } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import ConnectedAccount from '@/components/connected-account';

export default function Header() {
  return (
    <>
      <div className="flex min-h-[6.25rem] w-full items-center justify-between bg-surface-base px-4 lg:px-10">
        <div className="flex items-center gap-10">
          <NextLink href="/">
            <ZivoeLogo className="-ml-3 h-6" />
          </NextLink>

          <DesktopNavigation />
        </div>

        <div className="flex items-center gap-2">
          <Wallet />
          <MobileNavigation />
        </div>
      </div>

      <DynamicUserProfile />
    </>
  );
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
      <Button variant="border-light" className="lg:hidden">
        <HamburgerIcon />
      </Button>

      <NavigationMobileDialog>
        <NavigationItems />
      </NavigationMobileDialog>
    </Dialog>
  );
}

function NavigationItems() {
  const pathName = usePathname() ?? '';
  const state = React.useContext(OverlayTriggerStateContext);

  return (
    <>
      {NAVIGATION_ITEMS.map(({ href, title, isDisabled }) => {
        const isCurrent = pathName === href;

        return (
          <Link
            key={title}
            variant="nav"
            size="l"
            className="h-[3.5rem] text-base current:shadow-secondary hover:shadow-secondary lg:text-primary lg:current:shadow-active lg:hover:shadow-active"
            href={href}
            aria-current={isCurrent}
            isDisabled={isDisabled}
            onPress={() => state?.close()}
          >
            {title}
          </Link>
        );
      })}
    </>
  );
}

const NAVIGATION_ITEMS: Array<{ href: string; title: string; isDisabled?: boolean }> = [
  { title: 'Deposit', href: '/' },
  { title: 'Portfolio', href: '/portfolio' }
];

function Wallet() {
  const { setShowDynamicUserProfile, primaryWallet } = useDynamicContext();
  const { address } = useAccount();

  return (
    <ConnectedAccount fullWidth={false} type="skeleton">
      <Button
        key="connected-wallet-button"
        variant="border-light"
        onPress={() => setShowDynamicUserProfile(true)}
        className="text-small"
      >
        <div className="size-5">
          <WalletIcon walletKey={primaryWallet?.connector?.key} />
        </div>

        {truncateAddress(address)}
      </Button>
    </ConnectedAccount>
  );
}
