import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { InsightsApiError, normalizeCategory, normalizePaginatedPosts, normalizePost } from './normalize';
import {
  INSIGHTS_PAGE_SIZE,
  INSIGHTS_TAG,
  type InsightSlugEntry,
  findAllInsightSlugs,
  findCategories,
  findFallbackInsightPosts,
  findInsightPostBySlug,
  findInsightsPosts,
  findRelatedInsightPosts
} from './queries';

export type {
  InsightsAuthor,
  InsightsCategory,
  InsightsMedia,
  InsightsRichTextDocument,
  InsightsPostDocument,
  PaginatedInsightsPosts
} from './types';

export { INSIGHTS_PAGE_SIZE, INSIGHTS_TAG } from './queries';

async function getCategories(preview: boolean) {
  try {
    const response = await findCategories(preview);

    return response.docs.map((category) => normalizeCategory(category));
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        source: 'SERVER',
        target: 'insights-categories'
      }
    });

    throw error;
  }
}

const getCategoriesCached = reactCache(
  nextCache(() => getCategories(false), ['insights-categories'], { tags: [INSIGHTS_TAG] })
);

const getPostsPageCached = reactCache(
  nextCache(
    async ({ categoryId, page, search }: { categoryId?: string; page: number; search?: string }) => {
      try {
        const response = await findInsightsPosts({
          categoryId,
          limit: INSIGHTS_PAGE_SIZE,
          page,
          preview: false,
          search
        });

        return normalizePaginatedPosts(response, INSIGHTS_PAGE_SIZE);
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            source: 'SERVER',
            target: 'insights-list'
          }
        });

        throw error;
      }
    },
    ['insights-page'],
    { tags: [INSIGHTS_TAG] }
  )
);

const getPostBySlugCached = reactCache(
  nextCache(
    async ({ slug }: { slug: string }) => {
      try {
        const response = await findInsightPostBySlug({ preview: false, slug });

        const [post] = response.docs;
        return post ? normalizePost(post) : null;
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            source: 'SERVER',
            target: 'insight-post'
          },
          extra: {
            slug
          }
        });

        throw error;
      }
    },
    ['insights-post'],
    { tags: [INSIGHTS_TAG] }
  )
);

const getRelatedPostsCached = reactCache(
  nextCache(
    async ({ categoryId, currentPostId }: { categoryId: string; currentPostId: string }) => {
      try {
        const sameCategory = await findRelatedInsightPosts({
          categoryId,
          currentPostId,
          limit: 3,
          preview: false
        });

        const normalizedSameCategory = sameCategory.docs.map((post) => normalizePost(post));
        if (normalizedSameCategory.length >= 3) return normalizedSameCategory.slice(0, 3);

        const fallbackPosts = await findFallbackInsightPosts({
          currentPostId,
          limit: 6,
          preview: false
        });

        const combined = [...normalizedSameCategory];
        for (const post of fallbackPosts.docs.map((doc) => normalizePost(doc))) {
          if (combined.some((existing) => existing.id === post.id)) continue;
          combined.push(post);
          if (combined.length === 3) break;
        }

        return combined;
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            source: 'SERVER',
            target: 'insights-related-posts'
          },
          extra: {
            categoryId,
            currentPostId
          }
        });

        if (error instanceof InsightsApiError) throw error;
        throw error;
      }
    },
    ['insights-related-posts'],
    { tags: [INSIGHTS_TAG] }
  )
);

const getAllInsightSlugsCached = reactCache(
  nextCache(async () => findAllInsightSlugs(), ['insights-slugs-v2'], { tags: [INSIGHTS_TAG] })
);

type CachedInsightSlugEntry = {
  slug: string;
  updatedAt?: string;
};

export async function getInsightsCategories(preview: boolean) {
  return preview ? getCategories(true) : getCategoriesCached();
}

export async function getInsightsListing(args: {
  categorySlug?: string;
  page: number;
  preview: boolean;
  search?: string;
}) {
  const categories = await getInsightsCategories(args.preview);
  const selectedCategory = args.categorySlug
    ? (categories.find((category) => category.slug === args.categorySlug) ?? null)
    : null;
  const posts = args.preview
    ? await (async () => {
        try {
          const response = await findInsightsPosts({
            categoryId: selectedCategory?.id,
            limit: INSIGHTS_PAGE_SIZE,
            page: args.page,
            preview: true,
            search: args.search
          });

          return normalizePaginatedPosts(response, INSIGHTS_PAGE_SIZE);
        } catch (error) {
          Sentry.captureException(error, {
            tags: {
              source: 'SERVER',
              target: 'insights-list'
            }
          });

          throw error;
        }
      })()
    : await getPostsPageCached({
        categoryId: selectedCategory?.id,
        page: args.page,
        search: args.search
      });

  return {
    categories,
    posts,
    selectedCategory
  };
}

export async function getInsightPostBySlug(args: { preview: boolean; slug: string }) {
  if (args.preview) {
    try {
      const response = await findInsightPostBySlug(args);

      const [post] = response.docs;
      return post ? normalizePost(post) : null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          source: 'SERVER',
          target: 'insight-post'
        },
        extra: {
          slug: args.slug
        }
      });

      throw error;
    }
  }

  return getPostBySlugCached({ slug: args.slug });
}

export async function getRelatedInsightPosts(args: { categoryId: string; currentPostId: string; preview: boolean }) {
  if (args.preview) {
    try {
      const sameCategory = await findRelatedInsightPosts({
        categoryId: args.categoryId,
        currentPostId: args.currentPostId,
        limit: 3,
        preview: true
      });

      const normalizedSameCategory = sameCategory.docs.map((post) => normalizePost(post));
      if (normalizedSameCategory.length >= 3) return normalizedSameCategory.slice(0, 3);

      const fallbackPosts = await findFallbackInsightPosts({
        currentPostId: args.currentPostId,
        limit: 6,
        preview: true
      });

      const combined = [...normalizedSameCategory];
      for (const post of fallbackPosts.docs.map((doc) => normalizePost(doc))) {
        if (combined.some((existing) => existing.id === post.id)) continue;
        combined.push(post);
        if (combined.length === 3) break;
      }

      return combined;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          source: 'SERVER',
          target: 'insights-related-posts'
        },
        extra: {
          categoryId: args.categoryId,
          currentPostId: args.currentPostId
        }
      });

      if (error instanceof InsightsApiError) throw error;
      throw error;
    }
  }

  return getRelatedPostsCached({
    categoryId: args.categoryId,
    currentPostId: args.currentPostId
  });
}

export async function getAllInsightSlugs(): Promise<Array<CachedInsightSlugEntry>> {
  const entries = (await getAllInsightSlugsCached()) as Array<InsightSlugEntry | string>;

  return entries.flatMap((entry) => {
    if (typeof entry === 'string') {
      return entry ? [{ slug: entry }] : [];
    }

    return entry.slug ? [entry] : [];
  });
}

export function formatInsightDate(date: null | string) {
  if (!date) return 'Unpublished';

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date));
}
