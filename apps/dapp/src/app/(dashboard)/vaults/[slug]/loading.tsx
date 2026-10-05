import Container from '@/components/container';
import LoadingStatus from '@/components/loading-status';
import Page from '@/components/page';

import { DepositInfoSkeleton } from './deposit-info';
import EarnSkeleton from './deposit/earn-skeleton';
import ZivoeVaultHeader from './zivoe-vault-header';

export default function ZivoeVaultLoading() {
  return (
    <div className="bg-surface-base">
      <LoadingStatus />

      <Container>
        <ZivoeVaultHeader zivoeVault="loading" />
      </Container>

      <Page className="mt-10 flex gap-10 lg:mt-12 lg:flex-row">
        <DepositInfoSkeleton />
        <EarnSkeleton />
      </Page>
    </div>
  );
}
