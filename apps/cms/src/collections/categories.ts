import type { CollectionConfig } from 'payload';
import { slugField } from 'payload';

import { isAdminOrEditor } from '@/access/users';
import { preventInsightReferenceDeletion } from '@/lib/insights-references';
import { COLLECTION_GROUP } from '@/lib/constants';
import { revalidateInsightsAfterChange, revalidateInsightsAfterDelete } from '@/lib/revalidate';

const categorySlugField = slugField({
  useAsSlug: 'title'
});

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    group: COLLECTION_GROUP,
    useAsTitle: 'title'
  },
  access: {
    create: isAdminOrEditor,
    delete: isAdminOrEditor,
    read: () => true,
    update: isAdminOrEditor
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true
    },
    categorySlugField,
    {
      name: 'description',
      type: 'textarea'
    }
  ],
  hooks: {
    beforeDelete: [
      preventInsightReferenceDeletion('category', [
        {
          collection: 'insightsPosts',
          label: 'insights posts',
          where: (id) => ({
            category: {
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
