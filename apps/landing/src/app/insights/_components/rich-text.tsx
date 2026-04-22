import { Fragment, type ReactNode } from 'react';

import Image from 'next/image';

import type {
  SerializedAutoLinkNode,
  SerializedLinkNode,
  SerializedListItemNode,
  SerializedListNode,
  SerializedQuoteNode,
  SerializedTextNode,
  SerializedUploadNode
} from '@payloadcms/richtext-lexical';

import { INSIGHTS_RICH_TEXT_LINK_SIZES, INSIGHTS_RICH_TEXT_LINK_VARIANTS } from '@zivoe/cms-types/insights-rich-text';
import type { Media } from '@zivoe/cms-types/payload-types';
import { Link, type LinkProps } from '@zivoe/ui/core/link';

import type { InsightsRichTextDocument, InsightsRichTextNode } from '@/server/insights/types';

type RichTextNode = InsightsRichTextNode;
type RichTextLinkNode = Extract<RichTextNode, SerializedAutoLinkNode | SerializedLinkNode>;
type RichTextListNode = Extract<RichTextNode, SerializedListNode>;
type RichTextListItemNode = Extract<RichTextNode, SerializedListItemNode>;
type RichTextQuoteNode = Extract<RichTextNode, SerializedQuoteNode>;
type RichTextTextNode = Extract<RichTextNode, SerializedTextNode>;
type RichTextUploadNode = Extract<RichTextNode, SerializedUploadNode>;

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function isSafeHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) return true;
  try {
    return SAFE_URL_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

const LINK_VARIANTS = new Set(INSIGHTS_RICH_TEXT_LINK_VARIANTS);

const LINK_SIZES = new Set(INSIGHTS_RICH_TEXT_LINK_SIZES);

function isLinkVariant(value: string): value is (typeof INSIGHTS_RICH_TEXT_LINK_VARIANTS)[number] {
  return LINK_VARIANTS.has(value as (typeof INSIGHTS_RICH_TEXT_LINK_VARIANTS)[number]);
}

function isLinkSize(value: string): value is (typeof INSIGHTS_RICH_TEXT_LINK_SIZES)[number] {
  return LINK_SIZES.has(value as (typeof INSIGHTS_RICH_TEXT_LINK_SIZES)[number]);
}

export function InsightsRichText({ document }: { document: InsightsRichTextDocument }) {
  return (
    <div className="flex flex-col gap-6 text-regular leading-[1.875rem] text-secondary">
      {document.root.children.map((node, index) => (
        <Fragment key={getNodeKey(node, index)}>{renderNode(node)}</Fragment>
      ))}
    </div>
  );
}

function renderNode(node: RichTextNode): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p>{renderChildren(node.children)}</p>;
    case 'heading': {
      const Tag = node.tag === 'h3' ? 'h3' : 'h2';

      return (
        <Tag
          className={
            Tag === 'h2'
              ? 'font-heading text-[2rem] leading-[2.75rem] text-primary'
              : 'font-heading text-[1.625rem] leading-[2.25rem] text-primary'
          }
        >
          {renderChildren(node.children)}
        </Tag>
      );
    }
    case 'upload': {
      const media = isRichTextMedia(node.value) ? node.value : null;
      if (!media) return null;

      const imageUrl = media.sizes?.hero?.url ?? media.url ?? null;
      const nodeCaption =
        typeof node.fields?.caption === 'string' && node.fields.caption.trim().length > 0 ? node.fields.caption : null;
      if (!imageUrl) return null;

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
    case 'linebreak':
      return <br />;
    case 'text':
      return renderText(node);
    case 'autolink':
    case 'link':
      return renderLink(node);
    case 'list':
      return renderList(node);
    case 'listitem':
      return renderListItem(node);
    case 'quote':
      return renderQuote(node);
    default:
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[InsightsRichText] Unhandled node type: ${(node as { type?: string }).type ?? 'unknown'}`);
      }
      return null;
  }
}

function renderChildren(children?: Array<RichTextNode>) {
  if (!children?.length) return null;

  return children.map((child, index) => <Fragment key={getNodeKey(child, index)}>{renderNode(child)}</Fragment>);
}

function renderLink(node: RichTextLinkNode) {
  const href = typeof node.fields.url === 'string' ? node.fields.url : undefined;
  const rawVariant = typeof node.fields.variant === 'string' ? node.fields.variant : '';
  const rawSize = typeof node.fields.size === 'string' ? node.fields.size : '';
  const variant: LinkProps['variant'] = isLinkVariant(rawVariant) ? rawVariant : 'link-primary';
  const size: LinkProps['size'] = isLinkSize(rawSize) ? rawSize : 'xs';

  if (!href || !isSafeHref(href)) {
    return renderChildren(node.children);
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
      {renderChildren(node.children)}
    </Link>
  );
}

function renderList(node: RichTextListNode) {
  const Tag = node.tag === 'ol' ? 'ol' : 'ul';
  const className =
    Tag === 'ol'
      ? 'flex list-decimal flex-col gap-2 pl-6 marker:text-tertiary'
      : 'flex list-disc flex-col gap-2 pl-6 marker:text-tertiary';

  return <Tag className={className}>{renderChildren(node.children)}</Tag>;
}

function renderListItem(node: RichTextListItemNode) {
  return <li>{renderChildren(node.children)}</li>;
}

function renderQuote(node: RichTextQuoteNode) {
  return (
    <blockquote className="border-l-2 border-default pl-4 italic text-primary">
      {renderChildren(node.children)}
    </blockquote>
  );
}

function renderText(node: RichTextTextNode) {
  if (!node.text) return null;

  const isBold = typeof node.format === 'number' && (node.format & 1) !== 0;
  const isItalic = typeof node.format === 'number' && (node.format & 2) !== 0;

  let content: ReactNode = node.text;
  if (isBold) content = <strong>{content}</strong>;
  if (isItalic) content = <em>{content}</em>;

  return content;
}

function getNodeKey(node: RichTextNode, index: number) {
  const nodeId = 'id' in node && typeof node.id === 'string' ? node.id : index;
  return `${node.type}-${nodeId}`;
}

function isRichTextMedia(value: RichTextUploadNode['value']): value is Media {
  return typeof value === 'object' && value !== null && 'alt' in value;
}
