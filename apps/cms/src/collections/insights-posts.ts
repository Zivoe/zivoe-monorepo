import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload';
import { slugField } from 'payload';

import { canReadPublishedInsights, isAdminOrEditor } from '@/access/users';
import { extractPlainTextFromRichText } from '@/lib/extract-rich-text';
import { buildInsightsPreviewUrl } from '@/lib/preview';
import { insightsRichTextEditor } from '@/lib/rich-text';
import { revalidateInsightsAfterChange, revalidateInsightsAfterDelete } from '@/lib/revalidate';

const insightsSlugField = slugField({
  useAsSlug: 'title'
});

const setPublishedAtOnFirstPublish: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const isPublishingNow = data._status === 'published';
  const hadPublishedDate = Boolean(data.publishedAt ?? originalDoc?.publishedAt);

  if (isPublishingNow && !hadPublishedDate) {
    return {
      ...data,
      publishedAt: new Date().toISOString()
    };
  }

  return data;
};

const syncSearchBody: CollectionBeforeChangeHook = ({ data, originalDoc }) => ({
  ...data,
  searchBody: extractPlainTextFromRichText(data.body ?? originalDoc?.body)
});

export const InsightsPosts: CollectionConfig = {
  slug: 'insightsPosts',
  admin: {
    defaultColumns: ['title', 'category', '_status', 'publishedAt'],
    group: 'Insights',
    listSearchableFields: ['title', 'excerpt', 'searchBody'],
    livePreview: {
      url: ({ data }) => buildInsightsPreviewUrl(typeof data.slug === 'string' ? data.slug : null)
    },
    preview: (doc) => buildInsightsPreviewUrl(typeof doc.slug === 'string' ? doc.slug : null),
    useAsTitle: 'title'
  },
  access: {
    create: isAdminOrEditor,
    delete: isAdminOrEditor,
    read: canReadPublishedInsights,
    update: isAdminOrEditor
  },
  defaultSort: '-publishedAt',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Shown as the article heading and in listings.'
      }
    },
    insightsSlugField,
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      maxLength: 220,
      admin: {
        description: 'Short summary shown on cards and in search results. Max 220 characters.'
      }
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Hero image shown at the top of the article and on listing cards.'
      }
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
      required: true
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime'
        },
        description: 'Set automatically the first time this article is published.',
        readOnly: true
      }
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      editor: insightsRichTextEditor
    },
    {
      name: 'searchBody',
      type: 'textarea',
      admin: {
        hidden: true
      }
    },
    {
      type: 'collapsible',
      label: 'SEO',
      admin: {
        description: 'Overrides for search-engine and social-share metadata. Required before publishing.',
        initCollapsed: true
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          required: true,
          admin: {
            description: 'Appears in the browser tab and search results. Keep under 60 characters for best rendering.'
          }
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          required: true,
          maxLength: 180,
          admin: {
            description: 'Summary shown by search engines and social previews. Max 180 characters.'
          }
        },
        {
          name: 'seoImageOverride',
          type: 'relationship',
          relationTo: 'media',
          admin: {
            description: 'Optional. Falls back to featured image when empty.'
          }
        }
      ]
    }
  ],
  hooks: {
    beforeChange: [setPublishedAtOnFirstPublish, syncSearchBody],
    afterChange: [revalidateInsightsAfterChange],
    afterDelete: [revalidateInsightsAfterDelete]
  },
  versions: {
    drafts: true
  }
};
