import type { Field } from 'payload';

import {
  BlockquoteFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
  UploadFeature
} from '@payloadcms/richtext-lexical';
import { INSIGHTS_RICH_TEXT_LINK_SIZES, INSIGHTS_RICH_TEXT_LINK_VARIANTS } from '@zivoe/cms-types/insights-rich-text';

const linkVariantField: Field = {
  name: 'variant',
  type: 'select',
  required: true,
  defaultValue: 'link-primary',
  options: INSIGHTS_RICH_TEXT_LINK_VARIANTS.map((variant) => ({
    label: variant,
    value: variant
  }))
};

const linkSizeField: Field = {
  name: 'size',
  type: 'select',
  required: true,
  defaultValue: 'xs',
  options: INSIGHTS_RICH_TEXT_LINK_SIZES.map((size) => ({
    label: size,
    value: size
  }))
};

const uploadCaptionField: Field = {
  name: 'caption',
  type: 'text',
  required: false
};

export const insightsRichTextEditor = lexicalEditor({
  features: [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
    LinkFeature({
      enabledCollections: [],
      fields: ({ defaultFields }) => [...defaultFields, linkVariantField, linkSizeField]
    }),
    UploadFeature({
      collections: {
        media: {
          fields: [uploadCaptionField]
        }
      },
      enabledCollections: ['media']
    })
  ]
});
