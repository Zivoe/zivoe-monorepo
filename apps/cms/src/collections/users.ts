import type { CollectionConfig } from 'payload';

import { hasCmsAccess, isAdmin } from '@/access/users';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    defaultColumns: ['email', 'name', 'role'],
    group: 'Administration',
    useAsTitle: 'email'
  },
  access: {
    admin: hasCmsAccess,
    create: isAdmin,
    delete: isAdmin,
    read: isAdmin,
    update: isAdmin
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        {
          label: 'Admin',
          value: 'admin'
        },
        {
          label: 'Editor',
          value: 'editor'
        }
      ]
    }
  ]
};
