'use client';

import * as React from 'react';

import { usePathname, useRouter } from 'next/navigation';

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

import { signOut } from '@/lib/auth-client';
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
          <SignOut />
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
  { title: 'Earn', href: '/' },
  { title: 'Portfolio', href: '/portfolio' },
  { title: 'Transparency', href: '/transparency' },
  { title: 'Vesting', href: '/vesting' }
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

// TODO: Replace with dropdown with options
function SignOut() {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleSignOut = async () => {
    setIsPending(true);

    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/sign-in');
          router.refresh();
        }
      }
    });

    setIsPending(false);
  };

  return (
    <Button variant="border-light" onPress={handleSignOut} isPending={isPending} aria-label="Sign out">
      <LogoutIcon className="size-5" />
    </Button>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
