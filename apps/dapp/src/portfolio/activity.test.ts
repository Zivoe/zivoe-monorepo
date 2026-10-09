import { toEventSelector } from 'viem';
import { describe, expect, it } from 'vitest';

import { type InvestorActivityRow } from '@zivoe/centrifuge-indexer';

import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { buildActivity, cancelReturnCandidates, isCancelReturnReceipt } from './activity';

const SEPOLIA = FIXTURE_IDENTITY; // chain 11155111, USDC 6 decimals
const BASE = identityOnChain(SEPOLIA, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3',
  asset: { address: '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', symbol: 'USDT', decimals: 6 }
});
const IDENTITIES = [SEPOLIA, BASE];
const T0 = 1_786_000_000_000;

function row(overrides: Partial<InvestorActivityRow> & { type: InvestorActivityRow['type'] }): InvestorActivityRow {
  return {
    chainId: 11155111,
    txHash: '0xtx',
    timestampMs: T0,
    block: 1,
    tokenAmount: 100_000_000n,
    currencyAmount: null,
    asset: null,
    ...overrides
  };
}
const usdc = { address: SEPOLIA.centrifugeVault.asset.address.toLowerCase(), symbol: 'USDC', decimals: 6 };

describe('buildActivity', () => {
  it('folds each transaction into the entry the investor would name', () => {
    const entries = buildActivity({
      rows: [
        // A deposit: the SYNC_DEPOSIT row and the mint's TRANSFER_IN.
        row({ type: 'SYNC_DEPOSIT', txHash: '0xdep', timestampMs: T0 + 5, currencyAmount: 1_000_000n, asset: usdc }),
        row({ type: 'TRANSFER_IN', txHash: '0xdep', timestampMs: T0 + 5 }),
        // A request: REDEEM_REQUEST_UPDATED and the escrow leg.
        row({ type: 'REDEEM_REQUEST_UPDATED', txHash: '0xreq', timestampMs: T0 + 4, currencyAmount: 0n, asset: usdc }),
        row({ type: 'TRANSFER_OUT', txHash: '0xreq', timestampMs: T0 + 4 }),
        // Fulfilment and claim, on Base where the indexer names the coin USD₮0.
        row({
          type: 'REDEEM_CLAIMABLE',
          chainId: 84532,
          txHash: '0xfill',
          timestampMs: T0 + 3,
          currencyAmount: 1_140_000n,
          asset: { address: BASE.centrifugeVault.asset.address.toLowerCase(), symbol: 'USD₮0', decimals: 6 }
        }),
        row({
          type: 'REDEEM_CLAIMED',
          chainId: 84532,
          txHash: '0xclaim',
          timestampMs: T0 + 2,
          currencyAmount: 1_140_000n,
          asset: { address: BASE.centrifugeVault.asset.address.toLowerCase(), symbol: 'USD₮0', decimals: 6 }
        }),
        // Bare transfers: a manual issue, an unexplained receipt, a send.
        row({ type: 'TRANSFER_IN', txHash: '0xissue', timestampMs: T0 + 1 }),
        row({ type: 'TRANSFER_IN', txHash: '0xback', timestampMs: T0 }),
        row({ type: 'TRANSFER_OUT', txHash: '0xsend', timestampMs: T0 - 1 }),
        // A chain the deployment does not serve.
        row({
          type: 'SYNC_DEPOSIT',
          chainId: 5042,
          txHash: '0xarc',
          timestampMs: T0 + 10,
          currencyAmount: 1n,
          asset: usdc
        })
      ],
      issuances: [{ chainId: 11155111, txHash: '0xissue', shares: 100_000_000n }],
      cancelReturns: new Map([['0xback', true]]),
      identities: IDENTITIES
    });

    expect(entries.map((entry) => [entry.kind, entry.txHash])).toEqual([
      ['deposit', '0xdep'],
      ['redemption-requested', '0xreq'],
      ['redemption-processed', '0xfill'],
      ['proceeds-claimed', '0xclaim'],
      ['issued', '0xissue'],
      ['returned', '0xback'],
      ['sent', '0xsend']
    ]);
    expect(entries[0]).toMatchObject({
      chain: 'sepolia',
      shares: 100_000_000n,
      assets: { amount: 1_000_000n, symbol: 'USDC', decimals: 6 }
    });
    // The catalog's name for the coin wins over the indexer's.
    expect(entries[2]?.assets?.symbol).toBe('USDT');
    expect(entries[3]).toMatchObject({ shares: null, assets: { amount: 1_140_000n, symbol: 'USDT' } });
  });

  it('keeps a transaction once when its legs come back with the next page too', () => {
    const deposit = row({ type: 'SYNC_DEPOSIT', txHash: '0xdep', currencyAmount: 1_000_000n, asset: usdc });
    const mint = row({ type: 'TRANSFER_IN', txHash: '0xdep' });

    const entries = buildActivity({
      rows: [deposit, mint, deposit, mint],
      issuances: [],
      cancelReturns: new Map(),
      identities: IDENTITIES
    });

    expect(entries.map((entry) => entry.kind)).toEqual(['deposit']);
  });

  it('leaves a received transfer unresolved until its receipt answers', () => {
    const rows = [row({ type: 'TRANSFER_IN', txHash: '0xback' })];
    const draft = buildActivity({ rows, issuances: [], cancelReturns: new Map(), identities: IDENTITIES });

    expect(draft[0]).toMatchObject({ kind: 'received', unresolved: true });
    expect(cancelReturnCandidates(draft)).toEqual([{ chain: 'sepolia', txHash: '0xback' }]);

    const settled = buildActivity({
      rows,
      issuances: [],
      cancelReturns: new Map([['0xback', false]]),
      identities: IDENTITIES
    });
    expect(settled[0]).toMatchObject({ kind: 'received' });
    expect(settled[0]?.unresolved).toBeUndefined();
  });
});

describe('isCancelReturnReceipt', () => {
  const topic = toEventSelector(
    'CancelRedeemClaim(address indexed controller, address indexed receiver, uint256 indexed requestId, address sender, uint256 shares)'
  );
  const client = (logs: Array<{ address: string; topics: Array<string> }>) => ({
    getTransactionReceipt: () => Promise.resolve({ logs })
  });

  it("is true only for the event from one of the chain's catalogued vaults", async () => {
    const fromVault = [{ address: SEPOLIA.centrifugeVault.address.toUpperCase(), topics: [topic] }];
    const fromElsewhere = [{ address: '0x1111111111111111111111111111111111111111', topics: [topic] }];
    const otherEvent = [{ address: SEPOLIA.centrifugeVault.address, topics: ['0xabc'] }];

    await expect(
      isCancelReturnReceipt({ client: client(fromVault), txHash: '0x1', chain: 'sepolia', identities: IDENTITIES })
    ).resolves.toBe(true);
    await expect(
      isCancelReturnReceipt({ client: client(fromElsewhere), txHash: '0x1', chain: 'sepolia', identities: IDENTITIES })
    ).resolves.toBe(false);
    await expect(
      isCancelReturnReceipt({ client: client(otherEvent), txHash: '0x1', chain: 'sepolia', identities: IDENTITIES })
    ).resolves.toBe(false);
  });
});
