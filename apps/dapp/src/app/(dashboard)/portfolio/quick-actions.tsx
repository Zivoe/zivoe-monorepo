import { type ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon, ClockIcon, ExternalLinkIcon, MoneyHandIcon, ZSmbLogo } from '@zivoe/ui/icons';

import { LIGHTHOUSE_URL } from '@/lib/lighthouse';

import { LighthouseMark } from '@/components/lighthouse-mark';

import { type PortfolioVaultLink } from './portfolio-view';

/**
 * The four places an investor goes next, as a compact 2×2 of links at the
 * end of the page's right column; every on-chain action lives on the vault page.
 */
export function QuickActions({ zivoeVault }: { zivoeVault: PortfolioVaultLink }) {
  const actions: Array<{ title: string; href: string; icon: ReactNode; external?: true }> = [
    { title: 'Deposit', href: zivoeVault.path, icon: <ZSmbLogo /> },
    { title: 'Redeem', href: `${zivoeVault.path}?view=redeem`, icon: <MoneyHandIcon /> },
    { title: 'View Lighthouse', href: LIGHTHOUSE_URL, icon: <LighthouseMark />, external: true },
    { title: 'View Liquidity', href: `${LIGHTHOUSE_URL}/liquidity`, icon: <ClockIcon />, external: true }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {actions.map(({ title, href, icon, external }) => (
            <li key={title} className="min-w-0">
              <NextLink
                href={href}
                target={external ? '_blank' : undefined}
                className="group flex h-full items-center gap-3 rounded-lg border border-subtle bg-surface-base p-3 transition-colors hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-default focus-visible:outline-hidden"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-element-primary-gentle text-brand [&_svg]:size-4">
                  {icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-small font-medium text-primary">
                  {title}
                  {external && <span className="sr-only"> (opens in a new tab)</span>}
                </span>
                {external ? (
                  <ExternalLinkIcon aria-hidden="true" className="size-4 shrink-0 text-tertiary" />
                ) : (
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-tertiary transition-transform group-hover:translate-x-0.5"
                  />
                )}
              </NextLink>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
