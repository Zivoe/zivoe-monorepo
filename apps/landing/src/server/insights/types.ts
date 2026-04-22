import type {
  RecursiveNodes,
  SerializedAutoLinkNode,
  SerializedHeadingNode,
  SerializedLineBreakNode,
  SerializedLinkNode,
  SerializedListItemNode,
  SerializedListNode,
  SerializedParagraphNode,
  SerializedQuoteNode,
  SerializedTextNode,
  SerializedUploadNode,
  TypedEditorState
} from '@payloadcms/richtext-lexical';
import type { Author, Category, InsightsPost, Media } from '@zivoe/cms-types/payload-types';

type NormalizedMedia = Pick<Media, 'alt' | 'caption'> & {
  id: string;
  cardUrl: null | string;
  height: null | number;
  heroUrl: null | string;
  url: null | string;
  width: null | number;
};

export type InsightsMedia = NormalizedMedia;

export type InsightsAuthor = Pick<Author, 'bio' | 'name' | 'slug' | 'title'> & {
  avatar: InsightsMedia | null;
  id: string;
};

export type InsightsCategory = Pick<Category, 'description' | 'slug' | 'title'> & {
  id: string;
};

type InsightsBaseRichTextNode =
  | SerializedAutoLinkNode
  | SerializedHeadingNode
  | SerializedLineBreakNode
  | SerializedLinkNode
  | SerializedListItemNode
  | SerializedListNode
  | SerializedParagraphNode
  | SerializedQuoteNode
  | SerializedTextNode
  | SerializedUploadNode;

export type InsightsRichTextNode = RecursiveNodes<InsightsBaseRichTextNode>;

export type InsightsRichTextDocument = TypedEditorState<InsightsBaseRichTextNode>;

export type InsightsPostDocument = Pick<
  InsightsPost,
  'excerpt' | 'metaDescription' | 'metaTitle' | 'slug' | 'title' | 'updatedAt'
> & {
  author: InsightsAuthor;
  body: InsightsRichTextDocument;
  category: InsightsCategory;
  featuredImage: InsightsMedia;
  id: string;
  publishedAt: null | string;
  seoImageOverride: InsightsMedia | null;
};

export type PaginatedInsightsPosts = {
  docs: Array<InsightsPostDocument>;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
  nextPage: null | number;
  page: number;
  prevPage: null | number;
  totalDocs: number;
  totalPages: number;
};
