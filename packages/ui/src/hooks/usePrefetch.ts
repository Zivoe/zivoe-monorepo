import { HTMLAttributeAnchorTarget, useEffect } from 'react';

import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useRouter } from 'next/navigation';

const prefetchedUrls = new Set<string>();

export function usePrefetch({
  href,
  target,
  enabled
}: {
  href?: string;
  target?: HTMLAttributeAnchorTarget;
  enabled: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const shouldPrefetch = !!href && target === '_self' && enabled;
    if (!shouldPrefetch) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) prefetch({ href, router });
        });
      },
      { rootMargin: '200px' }
    );

    requestAnimationFrame(() => {
      const element = document.querySelector(`[href="${href}"]`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [enabled, href, router]);
}

function prefetch({ href, router }: { href: string; router: AppRouterInstance }) {
  if (typeof window === 'undefined') return;
  const prefetchKey = href;

  if (prefetchedUrls.has(prefetchKey)) return;
  prefetchedUrls.add(prefetchKey);

  try {
    router.prefetch(href, { kind: PrefetchKind.AUTO });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('Failed to prefetch:', error);
  }
}
