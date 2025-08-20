'use client';

import { Button } from '@zivoe/ui/core/button';

import { useTabNavigation } from '@/app/home/deposit/_hooks/useTabNavigation';

export default function RedeemButton() {
  const { navigateToTab } = useTabNavigation();

  return (
    <Button size="m" onPress={() => navigateToTab('redeem')}>
      Redeem
    </Button>
  );
}
