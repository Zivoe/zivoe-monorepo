import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

export function ChainLabel({ chain }: { chain: CentrifugeChain }) {
  const { label, Icon } = CHAIN_DISPLAY[chain];
  return (
    <span className="inline-flex items-center gap-2 align-middle whitespace-nowrap">
      <Icon aria-hidden="true" focusable="false" className="size-4 shrink-0 rounded-full" />
      <span>{label}</span>
    </span>
  );
}
