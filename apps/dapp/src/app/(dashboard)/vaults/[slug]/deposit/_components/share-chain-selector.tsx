'use client';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { useTokenBalances } from '@/hooks/useBalance';

import { ChainBalanceDetail } from './chain-balance-detail';
import { type ChainIdentities } from './chain-switch';
import { ChainTokenSelector, selectorTokenOf, sortRowsByBalance } from './chain-token-selector';

/**
 * The redeem tab's chain selector: one row per CHAIN, whatever stablecoins it
 * accepts — the share token is the same for all of them — each showing that
 * chain's redeemable share balance: the position the user came here to
 * redeem, and the one signal that tells them which chain actually holds it.
 * Takes the page's chains and hands one back; the rows and their order (the
 * largest holding first) are its own.
 */
export function ShareChainSelector({
  chains,
  selectedChain,
  onSelect,
  isDisabled
}: {
  /** The page's identities grouped by chain, each group's default vault first. */
  chains: ReadonlyArray<ChainIdentities>;
  selectedChain: CentrifugeChain;
  onSelect: (chain: CentrifugeChain) => void;
  isDisabled: boolean;
}) {
  // Every chain's share balance, to order the rows by where the position is.
  const shareBalanceOf = useTokenBalances(
    chains.map(({ chain, identities: [identity] }) => ({
      chain,
      tokenAddress: identity.centrifugeVault.shareClass.shareTokenAddress
    }))
  );
  const rows = sortRowsByBalance(
    chains.map(({ chain, identities: [identity] }) => ({
      id: chain,
      chain,
      token: selectorTokenOf(identity.centrifugeVault.shareClass.symbol),
      detail: <ChainBalanceDetail identity={identity} token="share" />,
      shareTokenAddress: identity.centrifugeVault.shareClass.shareTokenAddress
    })),
    ({ chain, shareTokenAddress }) => shareBalanceOf({ chain, tokenAddress: shareTokenAddress })
  );

  return (
    <ChainTokenSelector
      title="Select network"
      rows={rows}
      selectedId={selectedChain}
      onSelect={(id) => {
        const next = chains.find((candidate) => candidate.chain === id);
        if (next) onSelect(next.chain);
      }}
      isDisabled={isDisabled}
    />
  );
}
