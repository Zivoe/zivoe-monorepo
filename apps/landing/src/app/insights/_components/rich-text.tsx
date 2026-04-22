import type { ReactNode } from 'react';

import Image from 'next/image';

import type {
  DefaultNodeTypes,
  SerializedAutoLinkNode,
  SerializedBlockNode,
  SerializedLinkNode,
  SerializedListNode,
  SerializedQuoteNode,
  SerializedUploadNode
} from '@payloadcms/richtext-lexical';
import { type JSXConvertersFunction, RichText } from '@payloadcms/richtext-lexical/react';

import type { InsightsEmbedBlockFields } from '@zivoe/cms-types/insights-embeds';
import { INSIGHTS_RICH_TEXT_LINK_SIZES, INSIGHTS_RICH_TEXT_LINK_VARIANTS } from '@zivoe/cms-types/insights-rich-text';
import type { Media } from '@zivoe/cms-types/payload-types';
import { Link, type LinkProps } from '@zivoe/ui/core/link';

import type { InsightsRichTextDocument } from '@/server/insights/types';

import { LinkedInPostEmbed, TwitterPostEmbed, YouTubeVideoEmbed } from './rich-text/embeds';

type RichTextNode = DefaultNodeTypes | SerializedBlockNode<InsightsEmbedBlockFields>;
type RichTextLinkNode = SerializedAutoLinkNode | SerializedLinkNode;
type RichTextListNode = SerializedListNode;
type RichTextQuoteNode = SerializedQuoteNode;
type RichTextUploadNode = SerializedUploadNode;

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const LINK_VARIANTS = new Set(INSIGHTS_RICH_TEXT_LINK_VARIANTS);
const LINK_SIZES = new Set(INSIGHTS_RICH_TEXT_LINK_SIZES);

const jsxConverters: JSXConvertersFunction<RichTextNode> = ({ defaultConverters }) => ({
  ...defaultConverters,
  autolink: ({ node, nodesToJSX }) => renderLink(node, nodesToJSX),
  link: ({ node, nodesToJSX }) => renderLink(node, nodesToJSX),
  heading: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children });
    const Tag = node.tag === 'h3' ? 'h3' : 'h2';

    return (
      <Tag
        className={
          Tag === 'h2'
            ? 'font-heading text-[2rem] leading-[2.75rem] text-primary'
            : 'font-heading text-[1.625rem] leading-[2.25rem] text-primary'
        }
      >
        {children}
      </Tag>
    );
  },
  list: ({ node, nodesToJSX }) => renderList(node, nodesToJSX),
  listitem: ({ node, nodesToJSX }) => <li>{nodesToJSX({ nodes: node.children })}</li>,
  paragraph: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children });
    return <p>{children?.length ? children : <br />}</p>;
  },
  quote: ({ node, nodesToJSX }) => renderQuote(node, nodesToJSX),
  upload: ({ node }) => renderUpload(node),
  blocks: {
    linkedInEmbed: ({ node }) => <LinkedInPostEmbed caption={readCaption(node.fields)} url={node.fields.url} />,
    twitterEmbed: ({ node }) => <TwitterPostEmbed caption={readCaption(node.fields)} url={node.fields.url} />,
    youtubeEmbed: ({ node }) => <YouTubeVideoEmbed caption={readCaption(node.fields)} url={node.fields.url} />
  },
  unknown: ({ node }) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[InsightsRichText] Unhandled node type: ${node.type ?? 'unknown'}`);
    }

    return null;
  }
});

export function InsightsRichText({ document }: { document: InsightsRichTextDocument }) {
  return (
    <RichText
      data={document}
      converters={jsxConverters}
      className="flex flex-col gap-6 text-regular leading-[1.875rem] text-secondary"
    />
  );
}

function isSafeHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) return true;

  try {
    return SAFE_URL_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

function isLinkSize(value: string): value is (typeof INSIGHTS_RICH_TEXT_LINK_SIZES)[number] {
  return LINK_SIZES.has(value as (typeof INSIGHTS_RICH_TEXT_LINK_SIZES)[number]);
}

function isLinkVariant(value: string): value is (typeof INSIGHTS_RICH_TEXT_LINK_VARIANTS)[number] {
  return LINK_VARIANTS.has(value as (typeof INSIGHTS_RICH_TEXT_LINK_VARIANTS)[number]);
}

function isRichTextMedia(value: RichTextUploadNode['value']): value is Media {
  return typeof value === 'object' && value !== null && 'alt' in value;
}

function readCaption(fields: { caption?: unknown }) {
  return typeof fields.caption === 'string' && fields.caption.trim().length > 0 ? fields.caption : null;
}

function renderLink(
  node: RichTextLinkNode,
  nodesToJSX: (args: { nodes: RichTextLinkNode['children'] }) => Array<ReactNode>
) {
  const href = typeof node.fields.url === 'string' ? node.fields.url : undefined;
  const rawVariant = typeof node.fields.variant === 'string' ? node.fields.variant : '';
  const rawSize = typeof node.fields.size === 'string' ? node.fields.size : '';
  const variant: LinkProps['variant'] = isLinkVariant(rawVariant) ? rawVariant : 'link-primary';
  const size: LinkProps['size'] = isLinkSize(rawSize) ? rawSize : 'l';

  if (!href || !isSafeHref(href)) {
    return nodesToJSX({ nodes: node.children });
  }

  return (
    <Link
      href={href}
      rel={node.fields.newTab ? 'noopener noreferrer' : undefined}
      target={node.fields.newTab ? '_blank' : undefined}
      variant={variant}
      size={size}
      className="decoration-current underline underline-offset-4"
    >
      {nodesToJSX({ nodes: node.children })}
    </Link>
  );
}

function renderList(
  node: RichTextListNode,
  nodesToJSX: (args: { nodes: RichTextListNode['children'] }) => Array<ReactNode>
) {
  const Tag = node.tag === 'ol' ? 'ol' : 'ul';
  const className =
    Tag === 'ol'
      ? 'flex list-decimal flex-col gap-2 pl-6 marker:text-tertiary'
      : 'flex list-disc flex-col gap-2 pl-6 marker:text-tertiary';

  return <Tag className={className}>{nodesToJSX({ nodes: node.children })}</Tag>;
}

function renderQuote(
  node: RichTextQuoteNode,
  nodesToJSX: (args: { nodes: RichTextQuoteNode['children'] }) => Array<ReactNode>
) {
  return (
    <blockquote className="border-l-2 border-default pl-4 italic text-primary">
      {nodesToJSX({ nodes: node.children })}
    </blockquote>
  );
}

function renderUpload(node: RichTextUploadNode) {
  const media = isRichTextMedia(node.value) ? node.value : null;
  if (!media) return null;

  const imageUrl = media.sizes?.hero?.url ?? media.url ?? null;
  if (!imageUrl) return null;

  const nodeCaption = readCaption(node.fields ?? {});

  return (
    <figure className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[8px] bg-surface-base-soft">
        <Image
          src={imageUrl}
          alt={media.alt}
          width={media.width ?? 1600}
          height={media.height ?? 900}
          sizes="(min-width: 1280px) 912px, (min-width: 640px) calc(100vw - 5rem), calc(100vw - 2rem)"
          className="w-full object-cover"
        />
      </div>
      {(nodeCaption ?? media.caption) ? (
        <figcaption className="text-small text-tertiary">{nodeCaption ?? media.caption}</figcaption>
      ) : null}
    </figure>
  );
}
