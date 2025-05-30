'use client';

import { ReactNode } from 'react';

import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { useAccount } from 'wagmi';

import { Button } from '@zivoe/ui/core/button';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

export default function ConnectedAccount({ children, fullWidth = true }: { children: ReactNode; fullWidth?: boolean }) {
  const { sdkHasLoaded, setShowAuthFlow } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  const { address } = useAccount();

  if (!sdkHasLoaded || (isLoggedIn && !address)) {
    return <Skeleton className={cn('h-10 rounded-[4px]', fullWidth ? 'w-full' : 'w-[9.0625rem]')} />;
  }

  if (!isLoggedIn || !address)
    return (
      <Button size="m" onPress={() => setShowAuthFlow(true)} fullWidth={fullWidth}>
        Connect Wallet
      </Button>
    );

  return children;
}
