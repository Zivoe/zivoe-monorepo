'use client';

import { usePathname } from 'next/navigation';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import NavigationMobileDialog from '@zivoe/ui/components/navigation-mobile-dialog';
import { Button } from '@zivoe/ui/core/button';
import { Dialog } from '@zivoe/ui/core/dialog';
import { NextLink } from '@zivoe/ui/core/link';
import { Link } from '@zivoe/ui/core/link';
import { ArrowRightIcon, HamburgerIcon, ZSmbLogo } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from './container';
import { LighthouseMark } from './lighthouse-mark';

export default function NavigationSection() {
  return (
    <Container className="z-10 flex-row items-center justify-between pt-4 lg:pt-8 lg:pr-8 lg:pl-25">
      <NextLink href="/" aria-label="Zivoe home">
        <ZivoeLogo aria-hidden="true" />
      </NextLink>
      <Navigation />
    </Container>
  );
}

function Navigation() {
  return (
    <>
      <Desktop />
      <Mobile />
    </>
  );
}

function Desktop() {
  return (
    <div className="hidden items-center gap-4 rounded-full border border-base/60 bg-surface-base/95 p-2 pl-6 shadow-[0px_16px_32px_0px_rgba(0,0,0,0.04)] backdrop-blur-sm lg:flex">
      <div className="flex items-center gap-6">
        <NavigationItems />
      </div>

      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-surface-elevated-emphasis" />

      <div className="flex items-center gap-3">
        {EXTERNAL_NAVIGATION_ITEMS.map(({ href, label, Icon, desktopClassName }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'group inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full pr-4 pl-2.5 font-heading text-[1rem] leading-6 whitespace-nowrap text-brand transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-900',
              desktopClassName
            )}
          >
            <span aria-hidden="true" className="flex shrink-0">
              <Icon className="size-8" />
            </span>
            {label}
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform motion-safe:group-hover:translate-x-0.5"
            />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Mobile() {
  return (
    <Dialog>
      <Button aria-label="Open navigation menu" variant="border-light" size="m" className="shadow-none lg:hidden">
        <HamburgerIcon aria-hidden="true" />
      </Button>

      <NavigationMobileDialog>
        <div className="flex w-[min(20rem,calc(100vw-2rem))] flex-col items-center gap-6 py-4">
          <div className="flex flex-col items-center gap-3">
            <NavigationItems />
          </div>
          <div className="grid w-full gap-3">
            {EXTERNAL_NAVIGATION_ITEMS.map(({ href, label, description, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border border-primary-300/25 bg-surface-base/[0.06] p-4 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-colors hover:border-primary-300/50 hover:bg-surface-base/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300"
              >
                <span aria-hidden="true" className="flex shrink-0">
                  <Icon className="size-8" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-heading text-[1.125rem] leading-6">{label}</span>
                  <span className="text-[0.75rem] leading-4 text-primary-300">{description}</span>
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="ml-auto size-4 shrink-0 text-primary-300 transition-transform motion-safe:group-hover:translate-x-1"
                />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ))}
          </div>
        </div>
      </NavigationMobileDialog>
    </Dialog>
  );
}

function NavigationItems() {
  const pathName = usePathname() ?? '';

  return (
    <>
      {NAVIGATION_ITEMS.map(({ href, title, target }) => {
        const isCurrent = pathName === href;

        return (
          <Link
            key={title}
            variant="nav"
            size="l"
            className="h-14 text-base hover:shadow-secondary lg:h-12 lg:text-primary lg:hover:shadow-active current:shadow-secondary lg:current:shadow-active"
            href={href}
            target={target}
            aria-current={isCurrent}
          >
            {title}
          </Link>
        );
      })}
    </>
  );
}

const NAVIGATION_ITEMS: Array<{ href: string; title: string; target?: string }> = [
  { title: 'Home', href: '/' },
  { title: 'Team', href: '/team' },
  { title: 'FAQ', href: '/faq' },
  { title: 'Insights', href: '/insights' }
];

const EXTERNAL_NAVIGATION_ITEMS = [
  {
    href: 'https://lighthouse.zivoe.com/',
    label: 'Lighthouse',
    description: 'View Transparency Dashboard',
    desktopClassName: 'bg-element-primary-gentle/80 hover:bg-element-primary-gentle',
    Icon: LighthouseMark
  },
  {
    href: 'https://app.zivoe.com/vaults/',
    label: 'Vaults',
    description: 'View zSMB Zivoe Credit',
    desktopClassName: 'bg-element-secondary-light hover:bg-element-secondary-gentle',
    Icon: ZSmbLogo
  }
];
