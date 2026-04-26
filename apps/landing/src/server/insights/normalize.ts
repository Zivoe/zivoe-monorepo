import type { Author, Category, InsightsPost, Media } from '@zivoe/cms-types/payload-types';

import type {
  InsightsAuthor,
  InsightsCategory,
  InsightsMedia,
  InsightsPostDocument,
  InsightsRichTextDocument,
  PaginatedInsightsPosts
} from './types';

export class InsightsApiError extends Error {
  constructor(
    message: string,
    readonly context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InsightsApiError';
  }
}

type PaginatedDocuments<T> = {
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

type PopulatedRelation<T> = Exclude<T, null | number | string | undefined>;
type CategoryDocument = Pick<Category, 'description' | 'id' | 'slug' | 'title'>;
type AuthorDocument = Pick<Author, 'avatar' | 'bio' | 'id' | 'name' | 'slug' | 'title'>;
type PostDocument = Pick<
  InsightsPost,
  | 'author'
  | 'body'
  | 'category'
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
>;

function isPopulatedRelation<T>(value: T): value is Extract<T, object> {
  return typeof value === 'object' && value !== null;
}

function getRelation<T>(value: T): null | PopulatedRelation<T> {
  if (!isPopulatedRelation(value)) {
    return null;
  }

  return value as PopulatedRelation<T>;
}

function isInsightsRichTextDocument(value: unknown): value is InsightsRichTextDocument {
  if (typeof value !== 'object' || value === null) return false;
  if (!('root' in value)) return false;

  const root = value.root;
  if (typeof root !== 'object' || root === null) return false;
  if (!('children' in root) || !Array.isArray(root.children)) return false;
  if (!('type' in root) || root.type !== 'root') return false;

  return true;
}

function requireRichTextDocument(value: unknown, post: Pick<InsightsPost, 'id' | 'slug'>): InsightsRichTextDocument {
  if (!isInsightsRichTextDocument(value)) {
    throw new InsightsApiError('Insight post body is not a valid Lexical document', {
      id: post.id,
      slug: post.slug
    });
  }

  return value;
}

function toMedia(value: Media | number | null | undefined) {
  if (!isPopulatedRelation(value)) return null;

  return {
    alt: value.alt,
    caption: value.caption ?? null,
    cardUrl: value.sizes?.card?.url ?? value.url ?? null,
    height: value.height ?? null,
    heroUrl: value.sizes?.hero?.url ?? value.url ?? null,
    id: `${value.id}`,
    url: value.url ?? null,
    width: value.width ?? null
  } satisfies InsightsMedia;
}

export function normalizeCategory(category: CategoryDocument): InsightsCategory {
  return {
    description: category.description ?? null,
    id: `${category.id}`,
    slug: category.slug,
    title: category.title
  };
}

export function normalizeAuthor(author: AuthorDocument): InsightsAuthor {
  return {
    avatar: toMedia(author.avatar),
    bio: author.bio ?? null,
    id: `${author.id}`,
    name: author.name,
    slug: author.slug,
    title: author.title ?? null
  };
}

function createFallbackAuthor(post: Pick<InsightsPost, 'id'>): InsightsAuthor {
  return {
    avatar: null,
    bio: null,
    id: `missing-author:${post.id}`,
    name: 'Unknown author',
    slug: 'unknown-author',
    title: null
  };
}

function createFallbackCategory(post: Pick<InsightsPost, 'id'>): InsightsCategory {
  return {
    description: null,
    id: `missing-category:${post.id}`,
    slug: 'uncategorized',
    title: 'Uncategorized'
  };
}

function createFallbackMedia(post: Pick<InsightsPost, 'id'>): InsightsMedia {
  return {
    alt: '',
    caption: null,
    cardUrl: null,
    height: null,
    heroUrl: null,
    id: `missing-media:${post.id}`,
    url: null,
    width: null
  };
}

export function normalizePost(post: PostDocument): InsightsPostDocument {
  const authorRelation = getRelation(post.author);
  const categoryRelation = getRelation(post.category);
  const featuredImageRelation = getRelation(post.featuredImage);

  const author = authorRelation ? normalizeAuthor(authorRelation) : createFallbackAuthor(post);
  const category = categoryRelation ? normalizeCategory(categoryRelation) : createFallbackCategory(post);
  const featuredImage = featuredImageRelation ? (toMedia(featuredImageRelation) ?? createFallbackMedia(post)) : createFallbackMedia(post);

  return {
    author,
    body: requireRichTextDocument(post.body, post),
    category,
    excerpt: post.excerpt,
    featuredImage,
    id: `${post.id}`,
    metaDescription: post.metaDescription,
    metaTitle: post.metaTitle,
    publishedAt: post.publishedAt ?? null,
    seoImageOverride: toMedia(post.seoImageOverride),
    slug: post.slug,
    title: post.title,
    updatedAt: post.updatedAt
  };
}

export function normalizePaginatedPosts(
  posts: PaginatedDocuments<PostDocument>,
  pageSize: number
): PaginatedInsightsPosts {
  return {
    docs: posts.docs.map((post) => normalizePost(post)),
    hasNextPage: posts.hasNextPage,
    hasPrevPage: posts.hasPrevPage,
    limit: posts.limit ?? pageSize,
    nextPage: posts.nextPage ?? null,
    page: posts.page ?? 1,
    prevPage: posts.prevPage ?? null,
    totalDocs: posts.totalDocs,
    totalPages: posts.totalPages
  };
}
