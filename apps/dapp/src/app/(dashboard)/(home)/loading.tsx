import LoadingStatus from '@/components/loading-status';

import HomeView from '../_zivoe-vaults/home-view';

/**
 * In a route group of its own so it covers the homepage only. A `loading.tsx`
 * directly under `(dashboard)` would also wrap every nested route, and a hard
 * load of a Zivoe Vault page would flash this skeleton before its own.
 */
export default function HomeLoading() {
  return (
    <>
      <LoadingStatus />
      <HomeView nav="loading" />
    </>
  );
}
