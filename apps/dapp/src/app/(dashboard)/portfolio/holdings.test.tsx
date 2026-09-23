// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { buildPortfolio, portfolioTokens, positionKey, tokenKey } from '@/portfolio/model';
import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { Allocation, Holdings } from './holdings';

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
  render(
    <>
      <Holdings model={data} />
      <Allocation model={data} />
    </>
  );
  const table = within(screen.getByRole('table'));
  expect(table.getByText((_, node) => node?.tagName === 'P' && node.textContent === '12 zSMB (partial)')).toBeTruthy();
  expect(table.getByText((_, node) => node?.tagName === 'P' && node.textContent === '12 USDC (partial)')).toBeTruthy();
  expect(table.getAllByText('Requests incomplete · view chains')).toHaveLength(2);
  expect(data.totalD18).toBeNull();
  expect(data.holdings.every((row) => row.sharePercent === null)).toBe(true);
  expect(screen.getByRole('img', { name: 'Allocation unavailable until all balances load' })).toBeTruthy();
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

it('links chart hover and legend hover, and restores all assets when the pointer leaves', () => {
  render(<Allocation model={allocationModel()} />);
  const chart = screen.getByRole('img', { name: /Portfolio allocation/ });
  const usdc = chart.querySelector('[data-asset="USDC"]')!;
  const zsmb = chart.querySelector('[data-asset="zSMB"]')!;
  const usdcButton = screen.getByRole('button', { name: 'Highlight USDC allocation: $10.00' });
  const zsmbButton = screen.getByRole('button', { name: 'Highlight zSMB allocation: $20.00' });

  fireEvent.mouseEnter(usdc);
  expect(usdc.getAttribute('opacity')).toBe('1');
  expect(zsmb.getAttribute('opacity')).toBe('0.2');
  expect(zsmbButton.className).toContain('opacity-40');
  expect(screen.getByText('$10.00')).toBeTruthy();

  fireEvent.mouseLeave(usdc);
  expect(zsmb.getAttribute('opacity')).toBe('1');
  expect(screen.getByText('Total value')).toBeTruthy();

  fireEvent.mouseEnter(zsmbButton);
  expect(usdc.getAttribute('opacity')).toBe('0.2');
  expect(zsmb.getAttribute('stroke-width')).toBe('18');
  expect(usdcButton.className).toContain('opacity-40');
  fireEvent.mouseLeave(zsmbButton);
  expect(usdc.getAttribute('opacity')).toBe('1');
});

it('supports keyboard focus and a single-asset allocation without empty interactive segments', () => {
  render(<Allocation model={allocationModel(0n)} />);
  const chart = screen.getByRole('img', { name: /Portfolio allocation/ });
  expect(chart.querySelectorAll('[data-asset]')).toHaveLength(1);
  const zsmb = chart.querySelector('[data-asset="zSMB"]')!;
  expect(zsmb.getAttribute('d')?.match(/A48/g)).toHaveLength(2);
  const button = screen.getByRole('button', { name: 'Highlight zSMB allocation: $20.00' });
  act(() => button.focus());
  expect(zsmb.getAttribute('stroke-width')).toBe('18');
  expect(screen.queryByText('Total value')).toBeNull();
  act(() => button.blur());
  expect(screen.getByText('Total value')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Highlight USDC allocation: $0.00' }).hasAttribute('disabled')).toBe(true);
});
