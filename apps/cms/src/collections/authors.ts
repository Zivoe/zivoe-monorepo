import type { CollectionConfig } from 'payload';
import { slugField } from 'payload';

import { isAdminOrEditor } from '@/access/users';
import { preventInsightReferenceDeletion } from '@/lib/insights-references';
import { COLLECTION_GROUP } from '@/lib/constants';
import { revalidateInsightsAfterChange, revalidateInsightsAfterDelete } from '@/lib/revalidate';

const authorSlugField = slugField({
  useAsSlug: 'name'
});

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    defaultColumns: ['name', 'title', 'updatedAt'],
    group: COLLECTION_GROUP,
    useAsTitle: 'name'
  },
  access: {
    create: isAdminOrEditor,
    delete: isAdminOrEditor,
    read: () => true,
    update: isAdminOrEditor
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    authorSlugField,
    {
      name: 'title',
      type: 'text'
    },
    {
      name: 'bio',
      type: 'textarea'
    },
    {
      name: 'avatar',
      type: 'relationship',
      relationTo: 'media'
    }
  ],
  hooks: {
    beforeDelete: [
      preventInsightReferenceDeletion('author', [
        {
          collection: 'insightsPosts',
          label: 'insights posts',
          where: (id) => ({
            author: {
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
