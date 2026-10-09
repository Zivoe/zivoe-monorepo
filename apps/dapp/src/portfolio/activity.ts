import { toEventSelector } from 'viem';

import {
  type CentrifugeChain,
  type InvestorActivityRow,
  type ManualShareIssuance,
  getChainId
} from '@zivoe/centrifuge-indexer';

import { chainOfChainId } from '@/lib/chains';

import { type TransactionIdentity } from '@/centrifuge';

/**
 * What one transaction did to the wallet, in the investor's words. Derived
 * from the indexer's rows by what the contracts actually emit:
 * - a sync deposit writes SYNC_DEPOSIT plus the mint's TRANSFER_IN;
 * - a redemption request writes REDEEM_REQUEST_UPDATED plus the escrow leg's TRANSFER_OUT;
 * - the manager's fulfilment writes REDEEM_CLAIMABLE, the investor's claim REDEEM_CLAIMED;
 * - a manual issue by the manager (the migrated positions) and the shares
 *   coming back from a cancellation both land as a bare TRANSFER_IN, told
 *   apart by the issuance record and by the receipt's CancelRedeemClaim event;
 * - what is left is a plain transfer in or out.
 * The indexer never writes a cancel row and never records an approval, so
 * neither is an entry here; the Redemptions card shows those live from chain.
 */
export type ActivityKind =
  | 'deposit'
  | 'redemption-requested'
  | 'redemption-processed'
  | 'proceeds-claimed'
  | 'issued'
  | 'returned'
  | 'received'
  | 'sent';

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  chain: CentrifugeChain;
  txHash: string;
  timestampMs: number;
  /** Share base units. */
  shares: bigint | null;
  /** The deposit asset side, in that asset's base units. */
  assets: { amount: bigint; symbol: string; decimals: number } | null;
  /** A received transfer whose receipt has not answered yet: it may still turn out to be a cancellation return. */
  unresolved?: true;
};

const KIND_ORDER: Array<ActivityKind> = [
  'deposit',
  'redemption-requested',
  'redemption-processed',
  'proceeds-claimed',
  'issued',
  'returned',
  'received',
  'sent'
];

/**
 * Feed entries from raw rows, newest first. Rows on chains the deployment
 * does not serve are dropped, like their balances are from the total.
 * `cancelReturns` holds the receipt verdict per transaction hash for the
 * received transfers that needed one (see `isCancelReturnReceipt`); a hash
 * not in it yet renders as unresolved.
 */
export function buildActivity({
  rows,
  issuances,
  cancelReturns,
  identities
}: {
  rows: ReadonlyArray<InvestorActivityRow>;
  issuances: ReadonlyArray<ManualShareIssuance>;
  cancelReturns: ReadonlyMap<string, boolean>;
  identities: ReadonlyArray<TransactionIdentity>;
}): Array<ActivityEntry> {
  const chainIds = new Set(identities.map((identity) => identity.centrifugeVault.chainId));
  // The catalog's name for an asset where it has one (USDT for USD₮0 and USDt alike), the indexer's otherwise.
  const catalogAssets = new Map(
    identities.map(({ centrifugeVault: vault }) => [
      `${vault.chainId}:${vault.asset.address.toLowerCase()}`,
      { symbol: vault.asset.symbol, decimals: vault.asset.decimals }
    ])
  );
  const issued = new Set(issuances.map((issuance) => `${issuance.chainId}:${issuance.txHash}`));

  // A boundary transaction's legs come back with the next page too (the page
  // fetch completes every transaction it touches), so one (type, tx) row is
  // kept once — the indexer's own key for a wallet's rows.
  const byTx = new Map<string, Array<InvestorActivityRow>>();
  for (const row of rows) {
    if (row.chainId === null || !chainIds.has(row.chainId)) continue;
    const key = `${row.chainId}:${row.txHash}`;
    const group = byTx.get(key) ?? [];
    if (group.some((seen) => seen.type === row.type)) continue;
    byTx.set(key, [...group, row]);
  }

  const entries: Array<ActivityEntry> = [];
  for (const [key, group] of byTx) {
    const chain = chainOfChainId(group[0]!.chainId!)!;
    const txHash = group[0]!.txHash;
    const assetsOf = (row: InvestorActivityRow) => {
      if (row.asset === null || row.currencyAmount === null) return null;
      const known = catalogAssets.get(`${row.chainId}:${row.asset.address}`);
      return {
        amount: row.currencyAmount,
        symbol: known?.symbol ?? row.asset.symbol ?? '',
        decimals: known?.decimals ?? row.asset.decimals
      };
    };
    const push = (kind: ActivityKind, row: InvestorActivityRow, extra: Partial<ActivityEntry> = {}) =>
      entries.push({
        id: `${key}:${kind}`,
        kind,
        chain,
        txHash,
        timestampMs: row.timestampMs,
        shares: row.tokenAmount,
        assets: assetsOf(row),
        ...extra
      });
    const consumed = new Set<InvestorActivityRow>();
    const consumeLeg = (type: 'TRANSFER_IN' | 'TRANSFER_OUT', shares: bigint | null) => {
      const leg = group.find((row) => row.type === type && !consumed.has(row) && row.tokenAmount === shares);
      if (leg) consumed.add(leg);
    };

    for (const row of group) {
      switch (row.type) {
        case 'SYNC_DEPOSIT':
          consumeLeg('TRANSFER_IN', row.tokenAmount);
          push('deposit', row);
          break;
        case 'REDEEM_REQUEST_UPDATED':
          consumeLeg('TRANSFER_OUT', row.tokenAmount);
          push('redemption-requested', row);
          break;
        case 'REDEEM_CLAIMABLE':
          push('redemption-processed', row);
          break;
        case 'REDEEM_CLAIMED':
          // The share figure on a claim row is derived upstream from an average price; the payout is the fact.
          push('proceeds-claimed', row, { shares: null });
          break;
      }
    }
    for (const row of group) {
      if (consumed.has(row)) continue;
      if (row.type === 'TRANSFER_OUT') push('sent', row);
      else if (row.type === 'TRANSFER_IN') {
        if (issued.has(key)) push('issued', row);
        else {
          const verdict = cancelReturns.get(txHash);
          push(verdict ? 'returned' : 'received', row, verdict === undefined ? { unresolved: true } : {});
        }
      }
    }
  }

  return entries.sort(
    (a, b) => b.timestampMs - a.timestampMs || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
  );
}

/** The received transfers that need a receipt before they can be named. */
export function cancelReturnCandidates(
  entries: ReadonlyArray<ActivityEntry>
): Array<{ chain: CentrifugeChain; txHash: string }> {
  return entries
    .filter((entry) => entry.kind === 'received' && entry.unresolved)
    .map((entry) => ({ chain: entry.chain, txHash: entry.txHash }));
}

// AsyncVault's event when an investor claims the shares a cancellation returned.
const CANCEL_REDEEM_CLAIM_TOPIC = toEventSelector(
  'CancelRedeemClaim(address indexed controller, address indexed receiver, uint256 indexed requestId, address sender, uint256 shares)'
);

/**
 * Whether a transaction's receipt carries a CancelRedeemClaim from one of
 * the chain's catalogued Centrifuge vaults — the one certain sign that a
 * bare TRANSFER_IN is shares coming back from a cancellation rather than a
 * transfer from another wallet. One read per candidate, cached for good.
 */
export async function isCancelReturnReceipt({
  client,
  txHash,
  chain,
  identities
}: {
  client: {
    getTransactionReceipt(args: {
      hash: `0x${string}`;
    }): Promise<{ logs: Array<{ address: string; topics: ReadonlyArray<string> }> }>;
  };
  txHash: string;
  chain: CentrifugeChain;
  identities: ReadonlyArray<TransactionIdentity>;
}): Promise<boolean> {
  const chainId = getChainId(chain);
  const vaults = new Set(
    identities
      .filter((identity) => identity.centrifugeVault.chainId === chainId)
      .map((identity) => identity.centrifugeVault.address.toLowerCase())
  );
  const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  return receipt.logs.some(
    (log) => vaults.has(log.address.toLowerCase()) && log.topics[0]?.toLowerCase() === CANCEL_REDEEM_CLAIM_TOPIC
  );
}
