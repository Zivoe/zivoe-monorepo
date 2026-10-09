import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { verifyOnboarded } from '@/server/data/auth';
import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';
import { getPortfolioPreviewWallets } from '@/server/data/portfolio-preview-wallets';

import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';

import { ZSMB_ZIVOE_VAULT, resolveZivoeVaultIdentities, zivoeVaultPath } from '@/zivoe-vaults';

import PortfolioView from './portfolio-view';

export const metadata = { title: 'Portfolio | Zivoe' };

export default async function PortfolioPage() {
  const zivoeVault = ZSMB_ZIVOE_VAULT;
  // One identity per Centrifuge vault (chain × deposit asset), resolved
  // server-side like the Zivoe Vault page does; the client reads only these.
  const identities = resolveZivoeVaultIdentities(zivoeVault);

  // The share price seeds the browser cache so the first paint prices the
  // position instead of waiting on a client fetch; the poll keeps it fresh.
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.app.shareMetrics({ shareClassKey: zivoeVault.shareClass.key }),
      queryFn: async () => {
        const payload = await getCurrentShareMetrics(zivoeVault.shareClass.key);
        if (!payload) throw new Error('Centrifuge current share metrics are unavailable');
        return payload;
      }
    }),
    verifyOnboarded()
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PortfolioView
        zivoeVault={{ name: zivoeVault.name, path: zivoeVaultPath(zivoeVault) }}
        identities={identities}
        previewWallets={getPortfolioPreviewWallets()}
      />
    </HydrationBoundary>
  );
}
