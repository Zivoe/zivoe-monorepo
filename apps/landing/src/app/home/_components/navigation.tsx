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
    <div className="hidden items-center gap-6 rounded-lg bg-surface-base px-4 py-3 shadow-[0px_16px_32px_0px_rgba(0,0,0,0.04)] lg:flex">
      <div className="flex gap-3">
        <NavigationItems />
      </div>

      <Link href="/" variant="primary" size="m">
        Start earning
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

      <DialogContent isFullScreen>
        <div className="flex h-full flex-1 flex-col items-center gap-6">
          <div className="bg-secondary rounded-4 bg-accent/10 flex h-full flex-col items-center justify-center gap-3">
            <NavigationItems />
          </div>

          <div className="text-primary">©Zivoe 2025. All Right Reserved.</div>
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
          <Link key={title} variant="ghost" size="m" href={href} target={target} aria-current={isCurrent}>
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
