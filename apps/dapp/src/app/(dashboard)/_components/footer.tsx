'use client';

import { usePathname } from 'next/navigation';

import { Link } from '@zivoe/ui/core/link';
import { copyrightLine } from '@zivoe/ui/lib/copyright';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { LINKS } from '@/types/constants';

export default function Footer() {
  const pathname = usePathname();
  const isDepositPage = pathname === '/';
  // The portfolio sits on the soft canvas, so its footer inverts (canvas
  // gutter, white box) and reads as one more card instead of a grey box
  // behind a white stripe. Every other page keeps the white page, grey box.
  const isOnCanvas = pathname === '/portfolio';

  return (
    <div
      className={cn('p-4 lg:pb-4', isOnCanvas ? 'bg-surface-elevated' : 'bg-surface-base', isDepositPage && 'pb-24.5')}
    >
      <div
        className={cn(
          'flex flex-col justify-between gap-6 rounded-sm p-6 md:flex-row',
          isOnCanvas ? 'bg-surface-base' : 'bg-surface-elevated'
        )}
      >
        <p className="order-2 text-regular text-primary md:order-1">{copyrightLine()}</p>

        <div className="order-1 flex gap-4 md:order-2">
          <FooterLink href={LINKS.TERMS_OF_USE}>Terms of Use</FooterLink>
          <FooterLink href={LINKS.REG_S_COMPLIANCE}>Reg S Compliance</FooterLink>
        </div>
      </div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} target="_blank" hideExternalLinkIcon variant="link-neutral-light" size="m">
      {children}
    </Link>
  );
}
