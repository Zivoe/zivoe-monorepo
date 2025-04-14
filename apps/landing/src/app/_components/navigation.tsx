'use client';

import { usePathname } from 'next/navigation';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { HamburgerIcon } from '@zivoe/ui/icons';

export default function Navigation() {
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

      <Link href="/" variant="primary" size="m" className="my-[10px] mr-[10px]">
        Start Earning
      </Link>
    </div>
  );
}

function Mobile() {
  return (
    <Dialog>
      <Button variant="border-light" size="m" className="lg:hidden">
        <HamburgerIcon />
      </Button>

      <DialogContent isFullScreen className="bg-element-primary" logoType="light">
        <div className="flex h-full flex-1 -translate-y-10 flex-col items-center gap-6">
          <div className="bg-secondary rounded-4 bg-accent/10 flex h-full flex-col items-center justify-center gap-3">
            <NavigationItems />
          </div>

          <div className="text-base">©Zivoe 2025. All Right Reserved.</div>
        </div>
      </DialogContent>
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
  { title: 'Newsletter', href: '/newsletter', target: '_blank' },
  { title: 'Docs', href: '/docs', target: '_blank' }
];
