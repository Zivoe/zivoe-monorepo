'use client';

import * as React from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { WalletIcon } from '@dynamic-labs/wallet-book';
import * as Sentry from '@sentry/nextjs';
import { usePostHog } from 'posthog-js/react';
import * as Aria from 'react-aria-components';
import { OverlayTriggerStateContext } from 'react-aria-components';
import { toast } from 'sonner';

import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';
import { Popover, PopoverTrigger } from '@zivoe/ui/core/popover';
import { Separator } from '@zivoe/ui/core/separator';
import { LogoutIcon } from '@zivoe/ui/icons';
import { tv } from '@zivoe/ui/lib/tw-utils';

import { signOut } from '@/lib/auth-client';
import { truncateAddress } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import ConnectedAccount from '@/components/connected-account';

export function NavigationItems() {
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

export function Wallet() {
  const { setShowDynamicUserProfile, primaryWallet } = useDynamicContext();
  const { address } = useAccount();

  return (
    <ConnectedAccount
      fullWidth={false}
      type="skeleton"
      connectSkeletonClassName="w-[6rem] sm:w-[9.0625rem]"
      connectCopy={
        <>
          <span className="hidden sm:block">Connect Wallet</span>
          <span className="block sm:hidden">Connect</span>
        </>
      }
    >
      <Button
        key="connected-wallet-button"
        variant="border-light"
        onPress={() => setShowDynamicUserProfile(true)}
        className="text-small"
      >
        <div className="hidden size-5 sm:block">
          <WalletIcon walletKey={primaryWallet?.connector?.key} />
        </div>

        {truncateAddress(address)}
      </Button>
    </ConnectedAccount>
  );
}

type User = {
  name: string;
  email: string;
  image: string | null;
};

const avatarButtonStyles = tv({
  base: 'flex shrink-0 items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-0',
  variants: {
    hasImage: {
      true: 'size-10 rounded-full hover:ring-4 hover:ring-default hover:ring-offset-0',
      false: 'size-12 rounded-[4px] bg-surface-elevated-low-emphasis text-secondary hover:bg-surface-elevated-contrast'
    }
  }
});

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const posthog = usePostHog();

  const [isPending, setIsPending] = React.useState(false);

  const hasImage = !!user.image;

  const handleSignOut = async () => {
    setIsPending(true);

    await signOut({
      fetchOptions: {
        onSuccess: () => {
          posthog.reset();
          router.push('/sign-in');
        },
        onError: (err) => {
          toast.error('Error signing out');
          Sentry.captureException(err, { tags: { flow: 'sign-out' } });
        }
      }
    });

    setIsPending(false);
  };

  return (
    <PopoverTrigger>
      <Aria.Button aria-label="User menu" className={avatarButtonStyles({ hasImage })}>
        <UserAvatar user={user} />
      </Aria.Button>

      <Popover className="p-4" placement="bottom end">
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={avatarButtonStyles({ hasImage, className: 'pointer-events-none' })}>
              <UserAvatar user={user} />
            </div>

            <div className="flex min-w-0 flex-col">
              <span className="truncate text-regular font-medium text-primary">{user.name}</span>
              <span className="truncate text-small text-secondary">{user.email}</span>
            </div>
          </div>

          <Separator />

          <Button
            variant="ghost-light"
            fullWidth
            onPress={handleSignOut}
            isPending={isPending}
            className="justify-start text-alert-contrast"
            pendingContent="Logging out..."
          >
            <LogoutIcon className="!size-4" />
            Logout
          </Button>
        </div>
      </Popover>
    </PopoverTrigger>
  );
}

function UserAvatar({ user }: { user: User }) {
  if (user.image) {
    return <img src={user.image} alt={user.name} className="size-10 rounded-full object-cover" />;
  }

  const initials = getInitials({ user });

  return <span className="text-regular font-medium text-secondary">{initials}</span>;
}

function getInitials({ user }: { user: User }) {
  const name = user.name.trim();

  if (name) {
    const parts = name.split(/\s+/);

    if (parts.length >= 2) {
      // "John Doe" → "JD"
      const first = [...parts[0]!][0];
      const last = [...parts[parts.length - 1]!][0];
      return `${first}${last}`.toUpperCase();
    }

    // "John" → "JO", "J" → "J"
    return [...name].slice(0, 2).join('').toUpperCase();
  }

  // "john@example.com" → "JO"
  const emailName = user.email.split('@')[0] ?? '';
  if (emailName) return [...emailName].slice(0, 2).join('').toUpperCase();

  return 'U';
}
