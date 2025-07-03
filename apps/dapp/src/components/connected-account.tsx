'use client';

import { ReactNode } from 'react';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

import { Button } from '@zivoe/ui/core/button';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { toast } from '@zivoe/ui/core/sonner';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useAccount } from '@/hooks/useAccount';
import { useChainalysis } from '@/hooks/useChainalysis';

export default function ConnectedAccount({
  children,
  fullWidth = true,
  type = 'loading'
}: {
  children: ReactNode;
  fullWidth?: boolean;
  type?: 'loading' | 'skeleton';
}) {
  const { setShowAuthFlow, handleLogOut } = useDynamicContext();
  const { isPending, isDisconnected, address } = useAccount();

  const assessment = useChainalysis();

  const handleDisconnect = async () => {
    try {
      await handleLogOut();
    } catch (error) {
      console.error(error);
      toast({ type: 'error', title: 'Error disconnecting wallet' });
    }
  };

  if (isPending || (address && (assessment.isFetching || assessment.isPending))) {
    return type === 'skeleton' ? (
      <Skeleton className={cn('h-12 rounded-[4px]', fullWidth ? 'w-full' : 'w-[9.0625rem]')} />
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

  if (assessment.isRiskyAddress) {
    return (
      <Button onPress={handleDisconnect} fullWidth={fullWidth}>
        Disconnect
      </Button>
    );
  }

  return children;
}
