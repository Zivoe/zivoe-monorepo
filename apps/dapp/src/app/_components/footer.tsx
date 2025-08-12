'use client';

import { useSelectedLayoutSegment, useSelectedLayoutSegments } from 'next/navigation';

import { Link } from '@zivoe/ui/core/link';
import { cn } from '@zivoe/ui/lib/tw-utils';

export default function Footer() {
  const segment = useSelectedLayoutSegment();
  const isDepositPage = segment === null;

  return (
    <div className={cn('bg-surface-base p-4 lg:pb-4', isDepositPage && 'pb-[6.125rem]')}>
      <div className="flex flex-col justify-between gap-6 rounded-[4px] bg-surface-elevated p-6 md:flex-row">
        <p className="order-2 text-regular text-primary md:order-1">©Zivoe 2025. All Right Reserved.</p>

        <div className="order-1 flex gap-4 md:order-2">
          <FooterLink href="https://docs.zivoe.com/terms/terms-of-use-privacy-policy">Terms of Use</FooterLink>
          <FooterLink href="https://docs.zivoe.com/terms/reg-s-compliance">Reg S Compliance</FooterLink>
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
