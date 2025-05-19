'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import NavigationMobileDialog from '@zivoe/ui/components/navigation-mobile-dialog';
import { Button } from '@zivoe/ui/core/button';
import { Dialog } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { HamburgerIcon } from '@zivoe/ui/icons';

import Container from './container';

export default function NavigationSection() {
  return (
    <Container className="z-10 flex-row items-center justify-between pt-4 lg:pl-[6.25rem] lg:pr-8 lg:pt-8">
      <NextLink href="/">
        <ZivoeLogo />
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
    <div className="hidden items-center gap-6 rounded-lg bg-surface-base shadow-[0px_16px_32px_0px_rgba(0,0,0,0.04)] lg:flex">
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
        Legacy App
      </Link>
    </div>
  );
}

function Mobile() {
  return (
    <Dialog>
      <Button variant="border-light" size="m" className="shadow-none lg:hidden">
        <HamburgerIcon />
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
            className="h-[3.5rem] text-base current:shadow-secondary hover:shadow-secondary lg:text-primary lg:current:shadow-active lg:hover:shadow-active"
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
  { title: 'About us', href: '/about-us' },
  { title: 'FAQ', href: '/faq' },
  { title: 'Newsletter', href: 'https://blog.zivoe.com', target: '_blank' },
  { title: 'Docs', href: 'https://docs.zivoe.com', target: '_blank' }
];
