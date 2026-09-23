import { type WalletActivity } from '@zivoe/centrifuge-indexer';

export function conversionDirection(entry: WalletActivity): 'deposit' | 'redemption' | null {
  if (entry.type === 'SYNC_DEPOSIT' || entry.type === 'DEPOSIT_CLAIMED') return 'deposit';
  if (entry.type === 'SYNC_REDEEM' || entry.type === 'REDEEM_CLAIMED') return 'redemption';
  return null;
}

function transactionKey(entry: WalletActivity) {
  return `${entry.chainId ?? entry.centrifugeId}:${entry.txHash.toLowerCase()}`;
}

function eventKey(entry: WalletActivity) {
  return `${transactionKey(entry)}:${entry.type}:${entry.assetAddress?.toLowerCase() ?? ''}`;
}

const isTransfer = (entry: WalletActivity) => entry.type === 'TRANSFER_IN' || entry.type === 'TRANSFER_OUT';

/** Collapse only unambiguous share legs of completed conversions, never whole transactions or lifecycle stages. */
export function groupPortfolioActivity(entries: ReadonlyArray<WalletActivity>, transfersOnly = false) {
  const unique = [...new Map(entries.map((entry) => [eventKey(entry), entry])).values()];
  const groups = new Map<string, Array<WalletActivity>>();
  for (const entry of unique) {
    const key = transactionKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const consumed = new Set<WalletActivity>();
  for (const group of groups.values()) {
    for (const transfer of group.filter(isTransfer)) {
      // Bridging is a separate action even when batched beside a vault action.
      if (
        transfer.chainId === null ||
        !transfer.tokenAmount ||
        transfer.transferMessageId ||
        transfer.transferLeg ||
        (transfer.fromCentrifugeId && transfer.toCentrifugeId && transfer.fromCentrifugeId !== transfer.toCentrifugeId)
      )
        continue;
      const candidates = group.filter((entry) => {
        const direction = conversionDirection(entry);
        return (
          direction !== null &&
          entry.chainId === transfer.chainId &&
          entry.block === transfer.block &&
          entry.tokenAmount === transfer.tokenAmount &&
          entry.currencyAmount !== null &&
          entry.assetAddress !== null &&
          transfer.type === (direction === 'deposit' ? 'TRANSFER_IN' : 'TRANSFER_OUT')
        );
      });
      if (candidates.length === 1) consumed.add(transfer);
    }
  }
  return unique
    .filter((entry) => !consumed.has(entry) && (!transfersOnly || isTransfer(entry)))
    .sort((a, b) => b.timestampMs - a.timestampMs || b.block - a.block || eventKey(a).localeCompare(eventKey(b)));
}
