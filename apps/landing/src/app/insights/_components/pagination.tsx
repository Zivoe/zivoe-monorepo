import { type ReactNode } from 'react';

import { ArrowLeftIcon, ArrowRightIcon } from '@zivoe/ui/icons';

import { NextLink } from '@zivoe/ui/core/link';

import { cn } from '@zivoe/ui/lib/tw-utils';

import { INSIGHTS_PAGE_SIZE } from '@/server/insights/queries';

function buildPageHref({
  category,
  page,
  search
}: {
  category?: string;
  page: number;
  search?: string;
}) {
  const params = new URLSearchParams();

  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', `${page}`);

  const query = params.toString();
  return query ? `/insights?${query}` : '/insights';
}

export function InsightsPagination({
  category,
  currentPage,
  search,
  totalDocs,
  totalPages
}: {
  category?: string;
  currentPage: number;
  search?: string;
  totalDocs: number;
  totalPages: number;
}) {
  if (totalPages <= 1 && totalDocs === 0) return null;

  const startIndex = totalDocs === 0 ? 0 : (currentPage - 1) * INSIGHTS_PAGE_SIZE + 1;
  const endIndex = totalDocs === 0 ? 0 : Math.min(currentPage * INSIGHTS_PAGE_SIZE, totalDocs);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex w-full flex-col gap-4 border-t border-default pt-6 text-regular text-tertiary lg:flex-row lg:items-center lg:justify-between">
      <p>{`Showing ${startIndex}-${endIndex} of ${totalDocs} posts`}</p>

      <div className="flex items-center gap-1 self-end">
        <PaginationArrow
          disabled={currentPage <= 1}
          href={buildPageHref({ category, page: currentPage - 1, search })}
          label="Previous page"
        >
          <ArrowLeftIcon className="size-4" />
        </PaginationArrow>

        {pages.map((page) => (
          <NextLink
            key={page}
            href={buildPageHref({ category, page, search })}
            className={cn(
              'flex size-8 items-center justify-center rounded-[2px] text-regular transition-colors',
              page === currentPage ? 'bg-element-neutral text-primary' : 'text-secondary hover:bg-element-neutral-light'
            )}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </NextLink>
        ))}

        <PaginationArrow
          disabled={currentPage >= totalPages}
          href={buildPageHref({ category, page: currentPage + 1, search })}
          label="Next page"
        >
          <ArrowRightIcon className="size-4" />
        </PaginationArrow>
      </div>
    </div>
  );
}

function PaginationArrow({
  children,
  disabled,
  href,
  label
}: {
  children: ReactNode;
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="flex size-8 items-center justify-center rounded-[2px] text-tertiary" aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <NextLink
      href={href}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-[2px] text-secondary transition-colors hover:bg-element-neutral-light hover:text-primary"
    >
      {children}
    </NextLink>
  );
}
