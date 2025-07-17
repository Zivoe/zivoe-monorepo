'use client';

import { ReactNode } from 'react';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

import { Button } from '@zivoe/ui/core/button';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { toast } from '@zivoe/ui/core/sonner';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useAccount } from '@/hooks/useAccount';
import { useChainalysis } from '@/hooks/useChainalysis';

export default function ConnectedAccount({ children, fullWidth = true }: { children: ReactNode; fullWidth?: boolean }) {
  const { setShowAuthFlow, handleLogOut } = useDynamicContext();
  const { isLoading, isDisconnected, address } = useAccount();

  const assessment = useChainalysis();

  const handleDisconnect = async () => {
    try {
      await handleLogOut();
    } catch (error) {
      console.error(error);
      toast({ type: 'error', title: 'Error disconnecting wallet' });
    }
  };

  if (isLoading || (address && (assessment.isFetching || assessment.isPending))) {
    <Button fullWidth={fullWidth} isPending pendingContent="Loading...">
      Pending
    </Button>;
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
