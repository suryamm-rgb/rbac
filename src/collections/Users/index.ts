import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { canManageUsers, canReadUsers, canUpdateUsers } from '@/access/role'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: canManageUsers,
    delete: canManageUsers,
    read: canReadUsers,
    update: canUpdateUsers,
  },
  admin: {
    defaultColumns: ['name', 'email', 'role', 'createdAt', 'updatedAt'],
    useAsTitle: 'name',
  },
  auth: true,

  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      access: {
        // Only admin can change email
        update: ({ req }) => req.user?.role === 'admin',
      },
      admin: {
        // Your Payload version expects readOnly: boolean, not a function.
        // We rely on access.update above for locking instead.
      },
    },

    {
      name: 'name',
      type: 'text',
    },

    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Contributor', value: 'contributor' },
        { label: 'Viewer', value: 'viewer' },
        { label: 'Analyst', value: 'analyst' },
      ],
      defaultValue: 'admin',
      required: true,
      access: {
        // Only admin can change role
        update: ({ req }) => req.user?.role === 'admin',
      },
      admin: {
        description: 'User role determines access permissions. Only admins can change roles.',
        position: 'sidebar',
      },
    },
  ],

  timestamps: true,
}
