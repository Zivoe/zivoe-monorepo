'use client';

import { usePathname, useRouter } from 'next/navigation';

import { useMediaQuery } from 'react-responsive';

import { isOfferingPath } from '@/offerings';

import { type DepositPageView } from '../_utils';
import { useEarnDialog } from './earn-dialog';

export function useTabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMediaQuery({ query: '(max-width: 1023px)' });
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

  // For changes outside of the tab component
  const navigateToTab = (view: NonNullable<DepositPageView>) => {
    const url = view === 'deposit' ? pathname : `${pathname}?view=${view}`;

    // Switching tabs on the Offering itself is not a navigation — only
    // arriving from elsewhere should leave a history entry behind.
    if (isOfferingPath(pathname)) router.replace(url, { scroll: false });
    else router.push(url);

    if (isMobile) setIsEarnDialogOpen(true);
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
