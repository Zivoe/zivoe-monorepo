'use client';

import { useRouter } from 'next/navigation';

import { useSetAtom } from 'jotai';
import { useMediaQuery } from 'react-responsive';

import { Button } from '@zivoe/ui/core/button';

import { depositDialogAtom } from '@/lib/store';

export default function RedeemButton() {
  const router = useRouter();
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const handlePress = () => {
    router.replace('/?view=redeem', { scroll: false });
    if (isMobile) setIsDepositDialogOpen(true);
  };

  return (
    <Button size="m" onPress={handlePress}>
      Redeem
    </Button>
  );
}
