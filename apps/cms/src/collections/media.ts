import type { CollectionConfig } from 'payload';

import { isAdminOrEditor } from '@/access/users';
import { preventInsightReferenceDeletion } from '@/lib/insights-references';
import { COLLECTION_GROUP } from '@/lib/constants';
import { revalidateInsightsAfterChange, revalidateInsightsAfterDelete } from '@/lib/revalidate';

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    group: COLLECTION_GROUP,
    useAsTitle: 'alt'
  },
  access: {
    create: isAdminOrEditor,
    delete: isAdminOrEditor,
    read: () => true,
    update: isAdminOrEditor
  },
  upload: {
    adminThumbnail: 'card',
    imageSizes: [
      {
        name: 'hero',
        width: 1600,
        height: 900,
        crop: 'center'
      },
      {
        name: 'card',
        width: 960,
        height: 640,
        crop: 'center'
      }
    ],
    mimeTypes: ['image/*']
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describes the image for screen readers and when the image fails to load.'
      }
    },
    {
      name: 'caption',
      type: 'text',
      admin: {
        description: 'Optional caption shown below the image when used inside article bodies.'
      }
    }
  ],
  hooks: {
    beforeDelete: [
      preventInsightReferenceDeletion('media item', [
        {
          collection: 'authors',
          label: 'author profiles',
          where: (id) => ({
            avatar: {
              equals: id
            }
          })
        },
        {
          collection: 'insightsPosts',
          label: 'insights post featured images',
          where: (id) => ({
            featuredImage: {
              equals: id
            }
          })
        },
        {
          collection: 'insightsPosts',
          label: 'insights post SEO images',
          where: (id) => ({
            seoImageOverride: {
              equals: id
            }
          })
        }
      ])
    ],
    afterChange: [revalidateInsightsAfterChange],
    afterDelete: [revalidateInsightsAfterDelete]
  }
};
