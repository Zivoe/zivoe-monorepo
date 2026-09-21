'use client';

import { usePathname } from 'next/navigation';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import NavigationMobileDialog from '@zivoe/ui/components/navigation-mobile-dialog';
import { NavigationMobileLink } from '@zivoe/ui/components/navigation-mobile-link';
import { Button } from '@zivoe/ui/core/button';
import { Dialog } from '@zivoe/ui/core/dialog';
import { NextLink } from '@zivoe/ui/core/link';
import { Link } from '@zivoe/ui/core/link';
import { HamburgerIcon, ZSmbLogo } from '@zivoe/ui/icons';

import { APP_URL, LIGHTHOUSE_URL } from '@/lib/utils';

import Container from './container';
import { LighthouseCta } from './lighthouse-cta';
import { LighthouseMark } from './lighthouse-mark';
import { VaultsCta } from './vaults-cta';

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
        <LighthouseCta size="m" />
        <VaultsCta size="m" />
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
        <NavigationItems />
        <div className="mt-3 grid w-80 max-w-full gap-3">
          <NavigationMobileLink
            href={LIGHTHOUSE_URL}
            target="_blank"
            title="Lighthouse"
            description="View the transparency dashboard"
            icon={<LighthouseMark />}
          />
          <NavigationMobileLink
            href={APP_URL}
            target="_blank"
            title="Vaults"
            description="View Zivoe SMB Credit (zSMB)"
            icon={<ZSmbLogo />}
          />
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
