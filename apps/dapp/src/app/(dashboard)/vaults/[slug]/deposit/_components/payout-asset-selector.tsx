'use client';

import { getTokenInfo } from '@/components/token-info';

import { type TransactionIdentity } from '@/centrifuge';

import { ChainBalanceDetail } from './chain-balance-detail';
import { ChainTokenSelector } from './chain-token-selector';

/**
 * The stablecoin a redemption request pays out in — one option per Centrifuge
 * vault the share class has on the selected chain, each with the wallet's
 * balance of that coin. Sits where the redeem tab's Estimated receive row
 * shows the static asset on single-asset chains: the share balance being
 * redeemed is one number per chain, so only the payout side needs choosing.
 * The same dialog-and-select control as the chain selectors, so the two
 * pickers on the tab read alike.
 */
export function PayoutAssetSelector({
  identities,
  selected,
  onSelect,
  isDisabled
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  selected: TransactionIdentity;
  onSelect: (identity: TransactionIdentity) => void;
  isDisabled: boolean;
}) {
  const rowId = (identity: TransactionIdentity) => identity.centrifugeVault.address.toLowerCase();

  return (
    <ChainTokenSelector
      title="Select token to receive"
      trigger="token"
      rows={identities.map((identity) => ({
        id: rowId(identity),
        chain: identity.centrifugeVault.chain,
        token: getTokenInfo(identity.centrifugeVault.asset.symbol) ?? {
          label: identity.centrifugeVault.asset.symbol,
          icon: null
        },
        detail: <ChainBalanceDetail identity={identity} token="asset" />
      }))}
      selectedId={rowId(selected)}
      onSelect={(id) => {
        const next = identities.find((candidate) => rowId(candidate) === id);
        if (next) onSelect(next);
      }}
      isDisabled={isDisabled}
    />
  );
}
