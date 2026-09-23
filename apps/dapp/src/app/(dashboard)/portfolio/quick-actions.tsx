import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon, ClockIcon, ExternalLinkIcon, MoneyHandIcon, ZSmbLogo } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { LIGHTHOUSE_URL } from '@/lib/lighthouse';

import { LighthouseMark } from '@/components/lighthouse-mark';

import { Card, vaultLink } from './common';

const actions = [
  {
    title: 'Deposit',
    description: 'Add capital to your vault',
    href: vaultLink('deposit'),
    icon: <ZSmbLogo className="size-6" />,
    iconBackground: 'bg-element-secondary-light',
    external: false
  },
  {
    title: 'Redeem',
    description: 'Request a redemption',
    href: vaultLink('redeem'),
    icon: <MoneyHandIcon className="size-6" />,
    iconBackground: 'bg-element-primary-light',
    external: false
  },
  {
    title: 'View Lighthouse',
    description: 'Portfolio transparency & reporting',
    href: LIGHTHOUSE_URL,
    icon: <LighthouseMark className="size-6" />,
    iconBackground: 'bg-element-primary-light',
    external: true
  },
  {
    title: 'View Liquidity',
    description: 'Redemption schedule & liquidity details',
    href: `${LIGHTHOUSE_URL}/liquidity`,
    icon: <ClockIcon className="size-6" />,
    iconBackground: 'bg-element-primary-light',
    external: true
  }
];

export function QuickActions() {
  return (
    <Card title="Actions" className="order-4">
      <div className="@container">
        <ul role="list" className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          {actions.map(({ title, description, href, icon, iconBackground, external }) => (
            <li key={title} className="min-w-0">
              <NextLink
                href={href}
                target={external ? '_blank' : undefined}
                className="group flex h-full flex-col gap-3 rounded-lg border border-default bg-surface-base p-3 transition-colors hover:bg-element-primary-light focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:outline-hidden motion-reduce:transition-none"
              >
                <span aria-hidden="true" className="flex items-center justify-between gap-2">
                  <span className={cn('flex size-9 items-center justify-center rounded-lg text-brand', iconBackground)}>
                    {icon}
                  </span>
                  {external ? (
                    <ExternalLinkIcon className="size-4 shrink-0 text-secondary group-hover:text-brand" />
                  ) : (
                    <ArrowRightIcon className="size-4 shrink-0 text-secondary group-hover:text-brand" />
                  )}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-small leading-5 font-medium text-primary">{title}</span>
                  <span className="text-extraSmall text-secondary">{description}</span>
                </span>
                {external && <span className="sr-only">(opens in a new tab)</span>}
              </NextLink>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
