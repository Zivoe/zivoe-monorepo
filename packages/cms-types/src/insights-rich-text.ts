export const INSIGHTS_RICH_TEXT_PARAGRAPH_STYLES = ['body', 'lead', 'note', 'footnote'] as const;

export type InsightsRichTextParagraphStyle = (typeof INSIGHTS_RICH_TEXT_PARAGRAPH_STYLES)[number];

export const INSIGHTS_RICH_TEXT_LINK_SIZES = ['xs', 's', 'm', 'l'] as const;

export const INSIGHTS_RICH_TEXT_LINK_VARIANTS = [
  'link-base',
  'link-primary',
  'link-secondary',
  'link-neutral-dark',
  'link-neutral-light',
  'link-alert',
  'link-tertiary'
] as const;
