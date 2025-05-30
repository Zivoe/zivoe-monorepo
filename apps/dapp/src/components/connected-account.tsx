'use client';

import { ReactNode } from 'react';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

import { Button } from '@zivoe/ui/core/button';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useAccount } from '@/hooks/useAccount';

export default function ConnectedAccount({
  children,
  fullWidth = true,
  type = 'loading'
}: {
  children: ReactNode;
  fullWidth?: boolean;
  type?: 'loading' | 'skeleton';
}) {
  const { setShowAuthFlow } = useDynamicContext();
  const { isPending, isDisconnected } = useAccount();

  if (isPending) {
    return type === 'skeleton' ? (
      <Skeleton className={cn('h-10 rounded-[4px]', fullWidth ? 'w-full' : 'w-[9.0625rem]')} />
    ) : (
      <Button fullWidth={fullWidth} isPending pendingContent="Loading...">
        Pending
      </Button>
    );
  }

  if (isDisconnected)
    return (
      <Button onPress={() => setShowAuthFlow(true)} fullWidth={fullWidth}>
        Connect Wallet
      </Button>
    );

  return children;
}
