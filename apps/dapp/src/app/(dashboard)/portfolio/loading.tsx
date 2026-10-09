import { SHARE_CLASSES } from '@zivoe/centrifuge-indexer';

import { ZSMB_ZIVOE_VAULT, zivoeVaultPath } from '@/zivoe-vaults';

import { PortfolioSkeleton } from './portfolio-skeleton';

export default function PortfolioLoading() {
  return (
    <div className="bg-surface-elevated">
      <PortfolioSkeleton
        zivoeVault={{ name: ZSMB_ZIVOE_VAULT.name, path: zivoeVaultPath(ZSMB_ZIVOE_VAULT) }}
        shareSymbol={SHARE_CLASSES[ZSMB_ZIVOE_VAULT.shareClass.key].symbol}
      />
    </div>
  );
}
