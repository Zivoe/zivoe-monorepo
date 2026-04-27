import { type ReactNode } from 'react';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NextLink } from '@zivoe/ui/core/link';

import { getInsightsListing } from '@/server/insights';
import { getInsightsPreviewSession } from '@/server/insights/preview';

import { EMAILS } from '@/lib/utils';

import Container from '@/components/container';
import Footer from '@/components/footer';
import Newsletter from '@/components/newsletter';

import { InsightCard } from './_components/card';
import { LeavePreviewBanner } from './_components/leave-preview';
import { InsightsPagination } from './_components/pagination';
import { InsightsSearchForm } from './_components/search-form';

type PageProps = {
  searchParams?: Promise<{
    category?: string;
    page?: string;
    search?: string;
  }>;
};

export const metadata: Metadata = {
  title: 'Insights | Zivoe',
  description: 'Read the latest Zivoe insights, updates, and perspectives on private credit.',
  alternates: {
    canonical: 'https://zivoe.com/insights'
  }
};

function buildInsightsListingHref({ category, page, search }: { category?: string; page: number; search?: string }) {
  const params = new URLSearchParams();

  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', `${page}`);

  const query = params.toString();
  return query ? `/insights?${query}` : '/insights';
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const previewSession = await getInsightsPreviewSession();
  const page = Number.parseInt(params?.page ?? '1', 10);
  const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
  const search = params?.search?.trim() ?? undefined;
  const categorySlug = params?.category?.trim() ?? undefined;

  const allCategoryParams = new URLSearchParams();
  if (search) allCategoryParams.set('search', search);

  const allCategoryHref = allCategoryParams.toString() ? `/insights?${allCategoryParams.toString()}` : '/insights';

  const { categories, posts, selectedCategory } = await getInsightsListing({
    categorySlug,
    page: normalizedPage,
    preview: previewSession.isEnabled,
    search
  });

  if (normalizedPage > 1 && (posts.totalPages === 0 || normalizedPage > posts.totalPages)) {
    redirect(
      buildInsightsListingHref({ category: selectedCategory?.slug, page: Math.max(posts.totalPages, 1), search })
    );
  }

  return (
    <>
      <Container className="gap-10 px-4 pb-20 pt-12 sm:px-10 lg:flex-row lg:items-start lg:gap-12 lg:pt-16 xl:px-[8.5rem]">
        <aside className="flex w-full flex-col gap-6 lg:sticky lg:top-28 lg:max-w-[18rem]">
          <div className="flex flex-col gap-3">
            <h1 className="font-heading text-[3rem] leading-[3.5rem] text-primary">Insights</h1>
            <p className="text-regular leading-[1.75rem] text-primary">
              Learn more about Zivoe, our approach and company updates.
            </p>
          </div>

          <InsightsSearchForm categorySlug={selectedCategory?.slug} search={search} />

          <div className="flex flex-wrap gap-2">
            <CategoryChip active={!selectedCategory} href={allCategoryHref}>
              All
            </CategoryChip>
            {categories.map((category) => {
              const params = new URLSearchParams();
              params.set('category', category.slug);
              if (search) params.set('search', search);

              return (
                <CategoryChip
                  key={category.id}
                  active={selectedCategory?.id === category.id}
                  href={`/insights?${params.toString()}`}
                >
                  {category.title}
                </CategoryChip>
              );
            })}
          </div>

          <div className="relative overflow-hidden rounded-[8px] bg-[#fb9943] px-5 py-6 text-base">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(30deg,rgba(255,255,255,0.18)_12%,transparent_12.5%,transparent_87%,rgba(255,255,255,0.18)_87.5%,rgba(255,255,255,0.18)),linear-gradient(150deg,rgba(255,255,255,0.18)_12%,transparent_12.5%,transparent_87%,rgba(255,255,255,0.18)_87.5%,rgba(255,255,255,0.18)),linear-gradient(90deg,rgba(255,255,255,0.12)_2%,transparent_2.5%,transparent_97%,rgba(255,255,255,0.12)_97.5%,rgba(255,255,255,0.12))] [background-position:0_0,0_0,33px_19px] [background-size:66px_38px]" />
            <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <p className="text-white min-w-0 font-heading text-[1.5rem] leading-[1.75rem] sm:text-[1.625rem] sm:leading-[1.875rem]">
                Have any
                <br />
                questions?
              </p>
              <a
                href={`mailto:${EMAILS.INVESTORS}`}
                className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-[2px] border border-[#e7e7e7] bg-[#fafafa] px-3 text-[0.625rem] font-medium leading-none text-primary shadow-[0_1px_2px_rgba(16,24,40,0.08)] transition-opacity hover:opacity-95"
              >
                Contact us
              </a>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-9">
          {posts.docs.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {posts.docs.map((post, index) => (
                <InsightCard key={post.id} post={post} priority={index < 2} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-[8px] border border-dashed border-default bg-surface-base-soft px-6 text-center">
              <h2 className="font-heading text-[2rem] leading-[2.5rem] text-primary">
                No insights matched your filters.
              </h2>
              <p className="mt-3 max-w-[30rem] text-regular leading-[1.75rem] text-secondary">
                Try a different search term or reset the category filter to explore the latest updates from Zivoe.
              </p>
            </div>
          )}

          <InsightsPagination
            category={selectedCategory?.slug}
            currentPage={posts.page}
            search={search}
            totalDocs={posts.totalDocs}
            totalPages={posts.totalPages}
          />

          {previewSession.isEnabled ? (
            <LeavePreviewBanner
              message="Preview mode is enabled. Draft CMS content is visible on this page."
              redirectTo="/insights"
            />
          ) : null}
        </div>
      </Container>

      <Newsletter />
      <Footer />
    </>
  );
}

function CategoryChip({ active, children, href }: { active: boolean; children: ReactNode; href: string }) {
  return (
    <NextLink
      href={href}
      className={[
        'inline-flex items-center rounded-full border px-4 py-2 text-small transition-colors',
        active
          ? 'border-primary bg-surface-brand text-base'
          : 'border-default bg-surface-base text-primary hover:border-contrast hover:bg-surface-base-soft'
      ].join(' ')}
    >
      <span className={active ? 'text-base' : undefined}>{children}</span>
    </NextLink>
  );
}
