'use client';

import { usePathname } from 'next/navigation';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import NavigationMobileDialog from '@zivoe/ui/components/navigation-mobile-dialog';
import { Button } from '@zivoe/ui/core/button';
import { Dialog } from '@zivoe/ui/core/dialog';
import { NextLink } from '@zivoe/ui/core/link';
import { Link } from '@zivoe/ui/core/link';
import { HamburgerIcon } from '@zivoe/ui/icons';

import Container from './container';

export default function NavigationSection() {
  return (
    <Container className="z-10 flex-row items-center justify-between pt-4 lg:pt-8 lg:pr-8 lg:pl-[6.25rem]">
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
    <div className="bg-surface-base hidden items-center gap-6 rounded-lg shadow-[0px_16px_32px_0px_rgba(0,0,0,0.04)] lg:flex">
      <div className="ml-5 flex gap-6">
        <NavigationItems />
      </div>

      <Link
        href="https://app.zivoe.com"
        target="_blank"
        hideExternalLinkIcon
        variant="primary"
        size="m"
        className="my-[10px] mr-[10px]"
      >
        Start Earning
      </Link>
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
        <NavigationItems />
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
            className="current:shadow-secondary hover:shadow-secondary lg:text-primary lg:current:shadow-active lg:hover:shadow-active h-[3.5rem] text-base"
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
  { title: 'Insights', href: '/insights' },
  { title: 'Docs', href: 'https://docs.zivoe.com', target: '_blank' }
];
