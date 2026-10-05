import NextLink from 'next/link';

import { describe, expect, it } from 'vitest';

import { renderRouterLink } from '@zivoe/ui/core/link';

// Lives here because `packages/ui` has no test runner; this config transforms its TSX.
describe('renderRouterLink', () => {
  const elementFor = (domProps: Parameters<typeof renderRouterLink>[0]['domProps']) =>
    renderRouterLink({ domProps, fallback: 'span' }).type;

  it('sends in-app hrefs through next/link', () => {
    expect(elementFor({ href: '/vaults/zivoe-smb-credit' })).toBe(NextLink);
  });

  it.each([
    { href: 'https://zivoe.com' },
    { href: '//zivoe.com' },
    { href: 'mailto:inquire@zivoe.com' },
    { href: '#details' },
    { href: '/terms', target: '_blank' }
  ])('keeps $href (target $target) a plain anchor', (domProps) => {
    expect(elementFor(domProps)).toBe('a');
  });

  it('renders the fallback element without an href or when disabled', () => {
    expect(elementFor({})).toBe('span');
    expect(elementFor({ href: '/vaults', 'aria-disabled': true })).toBe('span');
    expect(renderRouterLink({ domProps: {}, fallback: 'div' }).type).toBe('div');
  });
});
