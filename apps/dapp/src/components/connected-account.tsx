'use client';

import { ReactNode } from 'react';

import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAccount } from 'wagmi';

import { Button } from '@zivoe/ui/core/button';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

export default function ConnectedAccount({
  children,
  fullWidth = true,
  type = 'loading'
}: {
  children: ReactNode;
  fullWidth?: boolean;
  type?: 'loading' | 'skeleton';
}) {
  const { sdkHasLoaded, setShowAuthFlow } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  const { address } = useAccount();

  if (!sdkHasLoaded || (isLoggedIn && !address)) {
    return type === 'skeleton' ? (
      <Skeleton className={cn('h-10 rounded-[4px]', fullWidth ? 'w-full' : 'w-[9.0625rem]')} />
    ) : (
      <Button fullWidth={fullWidth} isPending pendingContent="Loading...">
        Pending
      </Button>
    );
  }

  if (!isLoggedIn || !address)
    return (
      <Button onPress={() => setShowAuthFlow(true)} fullWidth={fullWidth}>
        Connect Wallet
      </Button>
    );

  return children;
}
