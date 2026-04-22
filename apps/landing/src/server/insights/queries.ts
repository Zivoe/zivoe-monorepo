import 'server-only';

import type {
  Author,
  AuthorsSelect,
  CategoriesSelect,
  Category,
  InsightsPost,
  InsightsPostsSelect,
  Media,
  MediaSelect
} from '@zivoe/cms-types/payload-types';

import { getCms, getCmsRequestInit } from '../clients/cms';

export const INSIGHTS_TAG = 'insights';
export const INSIGHTS_PAGE_SIZE = 6;

const cms = getCms();

const mediaSelect = {
  alt: true,
  caption: true,
  filename: true,
  height: true,
  sizes: {
    card: {
      url: true
    },
    hero: {
      url: true
    }
  },
  url: true,
  width: true
} satisfies MediaSelect;

const authorSelect = {
  avatar: true,
  bio: true,
  name: true,
  slug: true,
  title: true
} satisfies AuthorsSelect;

const categorySelect = {
  description: true,
  slug: true,
  title: true
} satisfies CategoriesSelect;

const insightPostSelect = {
  author: true,
  body: true,
  category: true,
  excerpt: true,
  featuredImage: true,
  metaDescription: true,
  metaTitle: true,
  publishedAt: true,
  seoImageOverride: true,
  slug: true,
  title: true,
  updatedAt: true
} satisfies InsightsPostsSelect;

const insightPostPopulate = {
  authors: authorSelect,
  categories: categorySelect,
  media: mediaSelect
};

type PaginatedResult<T> = {
  docs: Array<T>;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit?: number;
  nextPage?: null | number;
  page?: number;
  prevPage?: null | number;
  totalDocs: number;
  totalPages: number;
};

type CategoryQueryDocument = Pick<Category, 'description' | 'id' | 'slug' | 'title'>;
type PostQueryDocument = Pick<
  InsightsPost,
  | 'body'
  | 'excerpt'
  | 'featuredImage'
  | 'id'
  | 'metaDescription'
  | 'metaTitle'
  | 'publishedAt'
  | 'seoImageOverride'
  | 'slug'
  | 'title'
  | 'updatedAt'
> & {
  author: number | Author;
  category: number | Category;
  featuredImage: number | Media;
  seoImageOverride?: number | Media | null;
};

function toCmsId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function buildInsightsWhere({ categoryId, search }: { categoryId?: string; search?: string }) {
  const where: Record<string, unknown> = {};

  if (categoryId) {
    where.category = {
      equals: toCmsId(categoryId)
    };
  }

  if (search) {
    where.or = [
      { title: { like: search } },
      { excerpt: { like: search } },
      { searchBody: { like: search } }
    ];
  }

  return Object.keys(where).length > 0 ? (where as never) : undefined;
}

export async function findCategories(preview: boolean): Promise<PaginatedResult<CategoryQueryDocument>> {
  return cms.find(
    {
      collection: 'categories',
      depth: 0,
      draft: preview,
      limit: 100,
      select: categorySelect,
      sort: 'title'
    },
    getCmsRequestInit(preview)
  );
}

export async function findInsightsPosts({
  categoryId,
  limit,
  page,
  preview,
  search
}: {
  categoryId?: string;
  limit: number;
  page: number;
  preview: boolean;
  search?: string;
}): Promise<PaginatedResult<PostQueryDocument>> {
  return cms.find(
    {
      collection: 'insightsPosts',
      depth: 2,
      draft: preview,
      limit,
      page,
      populate: insightPostPopulate,
      select: insightPostSelect,
      sort: '-publishedAt',
      where: buildInsightsWhere({ categoryId, search })
    },
    getCmsRequestInit(preview)
  );
}

export async function findInsightPostBySlug({
  preview,
  slug
}: {
  preview: boolean;
  slug: string;
}): Promise<PaginatedResult<PostQueryDocument>> {
  return cms.find(
    {
      collection: 'insightsPosts',
      depth: 2,
      draft: preview,
      limit: 1,
      page: 1,
      populate: insightPostPopulate,
      select: insightPostSelect,
      where: {
        slug: {
          equals: slug
        }
      }
    },
    getCmsRequestInit(preview)
  );
}

export async function findRelatedInsightPosts({
  categoryId,
  currentPostId,
  limit,
  preview
}: {
  categoryId: string;
  currentPostId: string;
  limit: number;
  preview: boolean;
}): Promise<PaginatedResult<PostQueryDocument>> {
  return cms.find(
    {
      collection: 'insightsPosts',
      depth: 2,
      draft: preview,
      limit,
      page: 1,
      populate: insightPostPopulate,
      select: insightPostSelect,
      sort: '-publishedAt',
      where: {
        and: [
          {
            category: {
              equals: toCmsId(categoryId)
            }
          },
          {
            id: {
              not_equals: toCmsId(currentPostId)
            }
          }
        ]
      }
    },
    getCmsRequestInit(preview)
  );
}

export async function findFallbackInsightPosts({
  currentPostId,
  limit,
  preview
}: {
  currentPostId: string;
  limit: number;
  preview: boolean;
}): Promise<PaginatedResult<PostQueryDocument>> {
  return cms.find(
    {
      collection: 'insightsPosts',
      depth: 2,
      draft: preview,
      limit,
      page: 1,
      populate: insightPostPopulate,
      select: insightPostSelect,
      sort: '-publishedAt',
      where: {
        id: {
          not_equals: toCmsId(currentPostId)
        }
      }
    },
    getCmsRequestInit(preview)
  );
}

const INSIGHTS_SLUG_FETCH_PAGE_SIZE = 200;

export type InsightSlugEntry = {
  slug: string;
  updatedAt: string;
};

// Fetches slug + updatedAt for every published post. Used by generateStaticParams (slug only) and
// the sitemap (updatedAt feeds <lastmod>). Paginates through results instead of a single capped
// `limit: 1000` query. Drafts are excluded because `draft: false` only returns published documents.
export async function findAllInsightSlugs(): Promise<Array<InsightSlugEntry>> {
  const entries: Array<InsightSlugEntry> = [];
  let page = 1;

  while (true) {
    const response = await cms.find(
      {
        collection: 'insightsPosts',
        depth: 0,
        draft: false,
        limit: INSIGHTS_SLUG_FETCH_PAGE_SIZE,
        page,
        select: {
          slug: true,
          updatedAt: true
        },
        sort: '-publishedAt'
      },
      getCmsRequestInit(false)
    );

    for (const doc of response.docs) {
      if (doc.slug && doc.updatedAt) entries.push({ slug: doc.slug, updatedAt: doc.updatedAt });
    }

    if (!response.hasNextPage) break;
    page += 1;
  }

  return entries;
}
