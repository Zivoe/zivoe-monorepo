'use client';

import { type TransactionIdentity } from '@/centrifuge';

import { ChainBalanceDetail } from './chain-balance-detail';
import { ChainTokenSelector, identityRowId, selectorTokenOf } from './chain-token-selector';

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
  return (
    <ChainTokenSelector
      title="Select token to receive"
      trigger="token"
      rows={identities.map((identity) => ({
        id: identityRowId(identity),
        chain: identity.centrifugeVault.chain,
        token: selectorTokenOf(identity.centrifugeVault.asset.symbol),
        detail: <ChainBalanceDetail identity={identity} token="asset" />
      }))}
      selectedId={identityRowId(selected)}
      onSelect={(id) => {
        const next = identities.find((candidate) => identityRowId(candidate) === id);
        if (next) onSelect(next);
      }}
      isDisabled={isDisabled}
    />
  );
}
