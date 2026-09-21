'use client';

import * as React from 'react';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { WalletIcon } from '@dynamic-labs/wallet-book';
import * as Sentry from '@sentry/nextjs';
import { usePostHog } from 'posthog-js/react';
import * as Aria from 'react-aria-components';
import { OverlayTriggerStateContext } from 'react-aria-components';
import { toast } from 'sonner';

import { Button } from '@zivoe/ui/core/button';
import { Link, NextLink } from '@zivoe/ui/core/link';
import { Popover, PopoverTrigger } from '@zivoe/ui/core/popover';
import { Separator } from '@zivoe/ui/core/separator';
import { ArrowRightIcon, LogoutIcon, ZSmbLogo } from '@zivoe/ui/icons';
import { tv } from '@zivoe/ui/lib/tw-utils';

import { signOutAction } from '@/server/actions/auth';

import { handlePromise, truncateAddress } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import ConnectedAccount from '@/components/connected-account';
import { LighthouseMark } from '@/components/lighthouse-mark';

export function NavigationItems({ mobile = false }: { mobile?: boolean }) {
  const pathName = usePathname() ?? '';
  const state = React.useContext(OverlayTriggerStateContext);

  return (
    <>
      {NAVIGATION_ITEMS.map(({ href, title, target, description, Icon }) => {
        const isCurrent = pathName === href;

        if (!mobile) {
          return (
            <Link
              key={title}
              variant="nav"
              size="l"
              className="h-14 text-base hover:shadow-secondary lg:text-primary lg:hover:shadow-active current:shadow-secondary lg:current:shadow-active"
              href={href}
              target={target}
              aria-current={isCurrent}
            >
              {title}
            </Link>
          );
        }

        return (
          <NextLink
            key={title}
            className="group flex shrink-0 items-center gap-3 rounded-lg border border-primary-300/25 bg-surface-base/[0.06] p-4 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-colors hover:border-primary-300/50 hover:bg-surface-base/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300"
            href={href}
            target={target}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => state?.close()}
          >
            <span aria-hidden="true" className="flex shrink-0">
              <Icon className="size-8" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-heading text-[1.125rem] leading-6">{title}</span>
              <span className="text-[0.75rem] leading-4 text-primary-300">{description}</span>
            </span>
            <ArrowRightIcon
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 text-primary-300 transition-transform motion-safe:group-hover:translate-x-1"
            />
            {target === '_blank' && <span className="sr-only">(opens in a new tab)</span>}
          </NextLink>
        );
      })}
    </>
  );
}

const NAVIGATION_ITEMS = [
  {
    title: 'Vaults',
    href: '/',
    target: '_self',
    description: 'View zSMB Zivoe Credit',
    Icon: ZSmbLogo
  },
  {
    title: 'Lighthouse',
    href: 'https://lighthouse.zivoe.com/',
    target: '_blank',
    description: 'View Transparency Dashboard',
    Icon: LighthouseMark
  }
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
  base: 'flex shrink-0 items-center justify-center transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-0',
  variants: {
    hasImage: {
      true: 'size-10 rounded-full hover:ring-4 hover:ring-default hover:ring-offset-0',
      false: 'size-12 rounded-sm bg-surface-elevated-low-emphasis text-secondary hover:bg-surface-elevated-contrast'
    }
  }
});

export function UserMenu({ user }: { user: User }) {
  const posthog = usePostHog();

  const [isPending, setIsPending] = React.useState(false);

  const hasImage = !!user.image;

  const handleSignOut = async () => {
    setIsPending(true);

    const { res, err } = await handlePromise(signOutAction());

    if (err) {
      const isRedirect = err instanceof Error && err.message.includes('NEXT_REDIRECT');

      if (isRedirect) posthog.reset();
      else {
        toast.error('Error signing out');
        Sentry.captureException(err, { tags: { flow: 'sign-out' } });
      }
    } else if (!res) {
      toast.error('Error signing out');
      Sentry.captureException('Unexpected error signing out', { tags: { flow: 'sign-out' } });
    } else if (res.error) {
      toast.error(res.error);
    }

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

          <Link variant="ghost-light" fullWidth className="justify-start" href="/unsubscribe">
            Settings
          </Link>

          <Button
            variant="ghost-light"
            fullWidth
            onPress={handleSignOut}
            isPending={isPending}
            className="justify-start text-alert-contrast"
            pendingContent="Logging out..."
          >
            <LogoutIcon className="size-4!" />
            Logout
          </Button>
        </div>
      </Popover>
    </PopoverTrigger>
  );
}

function UserAvatar({ user }: { user: User }) {
  const avatarSrc = getAvatarSrc(user.image);

  if (avatarSrc) {
    return (
      <Image src={avatarSrc} alt={user.name} width={40} height={40} className="size-10 rounded-full object-cover" />
    );
  }

  const initials = getInitials({ user });

  return <span className="text-regular font-medium text-secondary">{initials}</span>;
}

const ALLOWED_AVATAR_HOSTS = new Set(['lh3.googleusercontent.com', 'pbs.twimg.com', 'abs.twimg.com']);

function getAvatarSrc(image: string | null) {
  if (!image) return null;
  if (image.startsWith('/')) return image;

  try {
    const url = new URL(image);
    if (url.protocol !== 'https:') return null;
    if (!ALLOWED_AVATAR_HOSTS.has(url.hostname)) return null;
    return image;
  } catch {
    return null;
  }
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
