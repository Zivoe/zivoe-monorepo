import { formatNav } from '@/lib/utils';

import TextSkeleton from '@/components/text-skeleton';

/**
 * A NAV figure in USD, for inside the text element that styles it: a dash
 * when the indexer read failed (null), a pulse sized by `skeletonClassName`
 * while the page's data is on its way.
 */
export default function NavValue({
  nav,
  skeletonClassName
}: {
  nav: number | null | 'loading';
  skeletonClassName: string;
}) {
  if (nav === 'loading') return <TextSkeleton className={skeletonClassName} />;
  return nav !== null ? `$${formatNav(nav)}` : '—';
}
