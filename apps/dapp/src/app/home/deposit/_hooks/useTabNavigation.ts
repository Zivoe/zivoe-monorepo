'use client';

import { usePathname, useRouter } from 'next/navigation';

import { useSetAtom } from 'jotai';
import { useMediaQuery } from 'react-responsive';

import { depositDialogAtom } from '@/lib/store';

import { DepositPageView } from '../_utils';

export function useTabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  // For changes outside of the tab component
  const navigateToTab = (view: NonNullable<DepositPageView>) => {
    const url = view === 'deposit' ? pathname : `${pathname}?view=${view}`;

    if (pathname === '/') router.replace(url, { scroll: false });
    else router.push(url);

    if (isMobile) setIsDepositDialogOpen(true);
  };

  // For changes within the tab component itself
  const updateTab = (view: NonNullable<DepositPageView>) => {
    const url = view === 'deposit' ? pathname : `${pathname}?view=${view}`;
    router.replace(url, { scroll: false });
  };

  return {
    navigateToTab,
    updateTab,
    isMobile
  };
}
