import { describe, expect, it, vi } from 'vitest';

import type { InvestorTransactionEvent } from '@zivoe/centrifuge-indexer';

import { chainsOfEnvironment, getChainDeployment } from '@zivoe/centrifuge-indexer';

import {
  USDC_DISPLAY,
  buildTxLink,
  formatEmailLine,
  formatTelegramItem,
  resolveChainDisplay
} from './centrifuge-tx-alert-message';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

function event(overrides: Partial<InvestorTransactionEvent> = {}): InvestorTransactionEvent {
  return {
    type: 'SYNC_DEPOSIT',
    centrifugeId: '1',
    chainId: 1,
    account: '0xb8da328a4edb64af841c6bb72b55988e9abeb172',
    tokenAmount: 4405778757590310318n,
    currencyAmount: 5000000n,
    tokenPrice: 1134873146180107400n,
    createdAtMs: 1786000000000,
    txHash: '0xccdab4d1b295d7a91f437ae2d9840b914cc8b94009c4edae1b44284f68cc619e',
    chainName: 'ethereum',
    explorerUrl: 'https://etherscan.io',
    ...overrides
  };
}

describe('formatEmailLine', () => {
  it('dedupes, trims, escapes, and pluralizes', () => {
    expect(formatEmailLine([])).toBe('Linked email: not found');
    expect(formatEmailLine(['  '])).toBe('Linked email: not found');
    expect(formatEmailLine(['a@b.c', 'a@b.c'])).toBe('Linked email: a@b.c');
    expect(formatEmailLine(['a<b@x.y', 'c@d.e'])).toBe('Linked emails: a&lt;b@x.y, c@d.e');
  });

  it('caps the list and counts the overflow — one wallet can link many users', () => {
    expect(formatEmailLine(['a@x.y', 'b@x.y', 'c@x.y', 'd@x.y', 'e@x.y'])).toBe('Linked emails: a@x.y, b@x.y, c@x.y +2 more');
  });
});

describe('buildTxLink', () => {
  it('joins explorer base and tx hash regardless of trailing slash', () => {
    const txHash = '0xabc';
    expect(buildTxLink({ explorerUrl: 'https://etherscan.io', txHash })).toBe('https://etherscan.io/tx/0xabc');
    expect(buildTxLink({ explorerUrl: 'https://scan.example/', txHash })).toBe('https://scan.example/tx/0xabc');
  });

  it('refuses missing or non-http explorer bases', () => {
    expect(buildTxLink({ explorerUrl: null, txHash: '0xabc' })).toBeNull();
    expect(buildTxLink({ explorerUrl: 'not a url', txHash: '0xabc' })).toBeNull();
    expect(buildTxLink({ explorerUrl: 'ftp://scan.example', txHash: '0xabc' })).toBeNull();
  });
});

describe('USDC_DISPLAY', () => {
  it('matches every chain-instantiated USDC — the uniformity that lets the formatter skip chain config', () => {
    for (const environment of ['mainnet', 'testnet'] as const) {
      for (const chain of chainsOfEnvironment(environment)) {
        const { symbol, decimals } = getChainDeployment(chain).usdc;
        expect({ chain, symbol, decimals }).toEqual({ chain, ...USDC_DISPLAY });
      }
    }
  });
});

describe('formatTelegramItem', () => {
  const shared = {
    symbol: 'zSMB',
    shareDecimals: 18,
    emailLine: 'Linked email: a@b.c'
  };

  it('formats a deposit with USDC, shares, execution price, and tx link', () => {
    const item = formatTelegramItem({ event: event(), ...shared });

    expect(item).toContain('<b>Deposit</b> — zSMB');
    expect(item).toContain('Account: <code>0xb8da328a4edb64af841c6bb72b55988e9abeb172</code>');
    expect(item).toContain('Linked email: a@b.c');
    expect(item).toContain('Amount: 5.00 USDC → 4.40 zSMB @ 1.1348');
    expect(item).toContain('Chain: Ethereum');
    expect(item).toContain(
      'href="https://etherscan.io/tx/0xccdab4d1b295d7a91f437ae2d9840b914cc8b94009c4edae1b44284f68cc619e"'
    );
  });

  it('formats a redemption request as a per-call delta without a price', () => {
    const item = formatTelegramItem({
      event: event({
        type: 'REDEEM_REQUEST_UPDATED',
        tokenAmount: 2000000000000000000n,
        currencyAmount: 0n,
        tokenPrice: 0n
      }),
      ...shared
    });

    expect(item).toContain('<b>Redemption Request</b> — zSMB');
    expect(item).toContain('Requested: 2.00 zSMB');
    expect(item).not.toContain(' @ ');
    expect(item).not.toContain('USDC');
  });

  it('formats a claimable redemption as shares → USDC at the execution price', () => {
    const item = formatTelegramItem({
      event: event({
        type: 'REDEEM_CLAIMABLE',
        tokenAmount: 2000000000000000000n,
        currencyAmount: 2269919n,
        tokenPrice: 1134959500000000000n
      }),
      ...shared
    });

    expect(item).toContain('<b>Redemption Claimable</b> — zSMB');
    expect(item).toContain('Amount: 2.00 zSMB → 2.26 USDC @ 1.1349');
  });

  it('formats a claimed redemption under its own label — same shape, different actor', () => {
    const item = formatTelegramItem({
      event: event({
        type: 'REDEEM_CLAIMED',
        tokenAmount: 2000000000000000000n,
        currencyAmount: 2269919n,
        tokenPrice: 1134959500000000000n
      }),
      ...shared
    });

    expect(item).toContain('<b>Redemption Claimed</b> — zSMB');
    expect(item).toContain('Amount: 2.00 zSMB → 2.26 USDC @ 1.1349');
  });

  it('escapes the dust marker — a raw `<0.01` is an unsupported tag to Telegram and 400s the pass', () => {
    const item = formatTelegramItem({
      event: event({ tokenAmount: 5000000000000000n, currencyAmount: 5000n }),
      ...shared
    });

    expect(item).toContain('Amount: &lt;0.01 USDC → &lt;0.01 zSMB');
    expect(item).not.toMatch(/<0\.01/);
  });

  it('falls back to an inline tx hash and the Centrifuge spoke id when the chain is unknown', () => {
    const item = formatTelegramItem({ event: event({ chainId: null, explorerUrl: null, chainName: null }), ...shared });

    expect(item).toContain(`Tx: <code>${event().txHash}</code>`);
    expect(item).toContain('Chain: Centrifuge chain 1');
  });
});

describe('resolveChainDisplay', () => {
  it('prefers the registry for a known chain id — the indexer names Sepolia "ethereum" and has no Pharos explorer', () => {
    expect(
      resolveChainDisplay(
        event({ chainId: 11155111, chainName: 'ethereum', explorerUrl: 'https://sepolia.etherscan.io' })
      )
    ).toEqual({
      label: 'Sepolia',
      explorerUrl: 'https://sepolia.etherscan.io'
    });
    expect(resolveChainDisplay(event({ chainId: 1672, chainName: 'pharos', explorerUrl: null }))).toEqual({
      label: 'Pharos Mainnet',
      explorerUrl: 'https://pharosscan.xyz'
    });
  });

  it('keeps the indexer values for a chain the registry does not know', () => {
    expect(
      resolveChainDisplay(
        event({ chainId: 10, chainName: 'optimism', explorerUrl: 'https://optimistic.etherscan.io/' })
      )
    ).toEqual({
      label: 'optimism',
      explorerUrl: 'https://optimistic.etherscan.io/'
    });
  });
});
