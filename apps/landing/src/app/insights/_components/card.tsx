import Image from 'next/image';

import { Badge } from '@zivoe/ui/core/badge';
import { NextLink } from '@zivoe/ui/core/link';
import { cn } from '@zivoe/ui/lib/tw-utils';

import type { InsightsPostDocument } from '@/server/insights';
import { formatInsightDate } from '@/server/insights';

export function InsightCard({
  post,
  priority = false,
  variant = 'default'
}: {
  post: InsightsPostDocument;
  priority?: boolean;
  variant?: 'compact' | 'default';
}) {
  const imageUrl = post.featuredImage.cardUrl ?? post.featuredImage.url;
  const isCompact = variant === 'compact';

  return (
    <NextLink
      href={`/insights/${post.slug}`}
      className={cn(
        'group flex h-full flex-col border border-default bg-surface-base transition-shadow duration-200 hover:shadow-[0px_8px_20px_rgba(16,24,40,0.05)]',
        isCompact ? 'min-h-[25rem] gap-0 p-3' : 'min-h-[32.5rem] gap-2 p-2'
      )}
    >
      <div
        className={cn(
          'overflow-hidden rounded-[8px] bg-surface-base-soft',
          isCompact ? 'aspect-[1.58/1] rounded-[4px]' : 'aspect-[16/11]'
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={post.featuredImage.alt}
            width={post.featuredImage.width ?? 960}
            height={post.featuredImage.height ?? 640}
            sizes={
              isCompact
                ? '(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 95vw'
                : '(min-width: 1280px) 45vw, (min-width: 768px) 60vw, 95vw'
            }
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-secondary">Placeholder</div>
        )}
      </div>

      <div className={cn('flex flex-1 flex-col', isCompact ? 'gap-5 px-1 pb-1 pt-4' : 'gap-6 px-3 pb-3 pt-1')}>
        <div className={cn('flex flex-1 flex-col', isCompact ? 'gap-3' : 'gap-4')}>
          <Badge variant="primary" className={cn('w-fit', isCompact && 'rounded-[3px] px-2 py-1 text-[0.6875rem] leading-[1rem]')}>
            {post.category.title}
          </Badge>

          <div className={cn('flex flex-col', isCompact ? 'gap-3' : 'gap-2')}>
            <h3
              className={cn(
                'font-heading text-primary transition-colors group-hover:text-brand',
                isCompact
                  ? 'line-clamp-2 text-[1.625rem] leading-[2rem]'
                  : 'text-[2rem] leading-[2.75rem]'
              )}
            >
              {post.title}
            </h3>
            <p className={cn(isCompact ? 'line-clamp-3 text-[0.9375rem] leading-[1.5rem] text-secondary' : 'text-regular leading-[1.75rem] text-secondary')}>
              {post.excerpt}
            </p>
          </div>
        </div>

        <p className={cn(isCompact ? 'text-[0.75rem] leading-[1rem] text-tertiary' : 'text-small text-tertiary')}>
          {formatInsightDate(post.publishedAt)}
        </p>
      </div>
    </NextLink>
  );
}
