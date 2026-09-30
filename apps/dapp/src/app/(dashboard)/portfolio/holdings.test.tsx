// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { buildPortfolio, portfolioTokens, positionKey, tokenKey } from '@/portfolio/model';
import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { Holdings } from './holdings';

afterEach(cleanup);

it('shows known wallet balances when requests fail without inventing totals or allocation', () => {
  const identities = [FIXTURE_IDENTITY, identityOnChain(FIXTURE_IDENTITY, 'base-sepolia')];
  const data = buildPortfolio({
    identities,
    balances: new Map(
      portfolioTokens(identities).map((token) => [
        tokenKey(token),
        token.chain === 'sepolia'
          ? { data: 12n * 10n ** BigInt(token.decimals), isError: false, isPending: false }
          : { isError: true, isPending: false }
      ])
    ),
    positions: new Map(),
    sharePrice: { data: 10n ** 18n, isError: false, isPending: false }
  });
  render(<Holdings model={data} />);
  const table = within(screen.getByRole('table'));
  expect(table.getByText((_, node) => node?.tagName === 'P' && node.textContent === '12 zSMB (partial)')).toBeTruthy();
  expect(table.getByText((_, node) => node?.tagName === 'P' && node.textContent === '12 USDC (partial)')).toBeTruthy();
  expect(table.getAllByText('Requests incomplete · view chains')).toHaveLength(2);
  expect(data.totalD18).toBeNull();
  expect(data.holdings.every((row) => row.sharePercent === null)).toBe(true);
  expect(screen.getByRole('img', { name: 'Distribution unavailable until all balances load' })).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Tokens' })).getByRole('img')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Distribution' })).toBeNull();
});

function allocationModel(stablecoinBalance = 10n) {
  const identities = [FIXTURE_IDENTITY];
  return buildPortfolio({
    identities,
    balances: new Map(
      portfolioTokens(identities).map((token) => [
        tokenKey(token),
        {
          data: (token.asset === 'zSMB' ? 10n : stablecoinBalance) * 10n ** BigInt(token.decimals),
          isError: false,
          isPending: false
        }
      ])
    ),
    positions: new Map([
      [
        positionKey(FIXTURE_IDENTITY),
        {
          data: {
            pendingRedeemShares: 0n,
            claimableRedeemAssets: 0n,
            claimableRedeemSharesEquivalent: 0n,
            unfundedClaimableAssets: 0n,
            claimableCancelRedeemShares: 0n,
            hasPendingCancelRedeemRequest: false
          },
          isError: false,
          isPending: false
        }
      ]
    ]),
    sharePrice: { data: 2n * 10n ** 18n, isError: false, isPending: false }
  });
}

it('links the integrated chart to token rows and restores all assets when the pointer leaves', () => {
  render(<Holdings model={allocationModel()} />);
  const chart = screen.getByRole('img', { name: /Portfolio distribution/ });
  const center = within(chart.parentElement!);
  const table = within(screen.getByRole('table'));
  const usdc = chart.querySelector('[data-asset="USDC"]')!;
  const zsmb = chart.querySelector('[data-asset="zSMB"]')!;
  const usdcRow = table.getByRole('button', { name: 'View USDC chains' }).closest('tr')!;
  const zsmbRow = table.getByRole('button', { name: 'View zSMB chains' }).closest('tr')!;

  fireEvent.mouseEnter(usdc);
  expect(usdc.getAttribute('opacity')).toBe('1');
  expect(zsmb.getAttribute('opacity')).toBe('0.2');
  expect(zsmbRow.className).toContain('opacity-40');
  expect(center.getByText('$10.00')).toBeTruthy();

  fireEvent.mouseLeave(usdc);
  expect(zsmb.getAttribute('opacity')).toBe('1');
  expect(center.getByText('Total value')).toBeTruthy();

  fireEvent.mouseEnter(zsmbRow);
  expect(usdc.getAttribute('opacity')).toBe('0.2');
  expect(zsmb.getAttribute('stroke-width')).toBe('18');
  expect(usdcRow.className).toContain('opacity-40');
  fireEvent.mouseLeave(zsmbRow);
  expect(usdc.getAttribute('opacity')).toBe('1');
  expect(screen.queryByRole('button', { name: /Highlight .* distribution/ })).toBeNull();
});

it('supports keyboard focus through token rows and a single asset without empty chart segments', () => {
  render(<Holdings model={allocationModel(0n)} />);
  const chart = screen.getByRole('img', { name: /Portfolio distribution/ });
  const center = within(chart.parentElement!);
  const table = within(screen.getByRole('table'));
  expect(chart.querySelectorAll('[data-asset]')).toHaveLength(1);
  const zsmb = chart.querySelector('[data-asset="zSMB"]')!;
  expect(zsmb.getAttribute('d')?.match(/A48/g)).toHaveLength(2);
  const button = table.getByRole('button', { name: 'View zSMB chains' });
  act(() => button.focus());
  expect(zsmb.getAttribute('stroke-width')).toBe('18');
  expect(center.queryByText('Total value')).toBeNull();
  act(() => button.blur());
  expect(center.getByText('Total value')).toBeTruthy();
  act(() => table.getByRole('button', { name: 'View USDC chains' }).focus());
  expect(zsmb.getAttribute('stroke-width')).toBe('15');
  expect(center.getByText('Total value')).toBeTruthy();
});
