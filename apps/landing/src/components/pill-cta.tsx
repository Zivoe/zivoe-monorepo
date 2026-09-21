import { type ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

export type PillCtaSize = 'm' | 'l';

/**
 * A brand-marked external CTA (Lighthouse, Vaults) used in the hero, the
 * sections and the navigation. Built on the design-system Link so rel,
 * prefetch and the focus ring stay the shared ones; `size` follows the button
 * scale (`m` for the navigation bar, `l` alongside body copy).
 */
export function PillCta({
  href,
  title,
  icon,
  tone,
  size = 'l'
}: {
  href: string;
  title: string;
  icon: ReactNode;
  tone: 'teal' | 'orange';
  size?: PillCtaSize;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      hideExternalLinkIcon
      variant={tone === 'teal' ? 'primary-light' : 'secondary-light'}
      size={size}
      className={cn(
        'group rounded-full',
        size === 'l' ? 'gap-3 pr-5 pl-2' : 'gap-2.5 pr-4 pl-1.5',
        tone === 'orange' && 'text-[#53210a]'
      )}
    >
      {/* The brand mark keeps its own size; the Link's icon rule only sizes the arrow. */}
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center [&>svg]:size-full!',
          size === 'l' ? 'size-8' : 'size-7'
        )}
      >
        {icon}
      </span>
      <span className={cn('font-normal', size === 'l' ? 'text-h7' : 'font-heading! text-regular')}>{title}</span>
      <ArrowRightIcon aria-hidden="true" className="transition-transform motion-safe:group-hover:translate-x-1" />
      <span className="sr-only">(opens in a new tab)</span>
    </Link>
  );
}
