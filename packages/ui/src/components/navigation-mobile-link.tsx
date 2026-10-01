'use client';

import { type ReactNode, useContext } from 'react';

import { OverlayTriggerStateContext } from 'react-aria-components';

import { Link } from '../core/link';
import { ArrowRightIcon } from '../icons';

/**
 * A destination card for the mobile navigation menu: a product mark, the name and one line on
 * what is behind it, styled for the dark surface of NavigationMobileDialog. Pressing it closes
 * the menu it sits in, so an in-app destination is reached with the menu gone and a new tab
 * leaves the page behind it as it was.
 */
export function NavigationMobileLink({
  href,
  title,
  description,
  icon,
  target,
  isCurrent = false
}: {
  href: string;
  title: string;
  description: string;
  /** The product mark; decorative, drawn at 32px. */
  icon: ReactNode;
  target?: '_blank';
  isCurrent?: boolean;
}) {
  const menu = useContext(OverlayTriggerStateContext);

  return (
    <Link
      href={href}
      target={target}
      hideExternalLinkIcon
      aria-current={isCurrent ? 'page' : undefined}
      onPress={() => menu?.close()}
      variant="link-base"
      className="group flex w-full items-center gap-3 rounded-lg border border-primary-300/25 bg-surface-base/5 p-4 text-left font-normal whitespace-normal hover:border-primary-300/50 hover:bg-surface-base/10 hover:no-underline focus-visible:ring-2 focus-visible:ring-primary-300 current:border-primary-300/50 pressed:bg-surface-base/15"
    >
      {/* The mark keeps its own size; the Link's icon rule only sizes the arrow. */}
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center [&>svg]:size-full!">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-heading! text-leading">{title}</span>
        <span className="text-extraSmall text-primary-300">{description}</span>
      </span>
      <ArrowRightIcon
        aria-hidden="true"
        className="shrink-0 text-primary-300 transition-transform motion-safe:group-hover:translate-x-1"
      />
      {target === '_blank' && <span className="sr-only">(opens in a new tab)</span>}
    </Link>
  );
}
