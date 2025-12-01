// import type { CollectionConfig } from 'payload'

// import { authenticated } from '../../access/authenticated'
// import { canManageUsers, canReadUsers, canUpdateUsers } from '@/access/role'
// import type { User } from '@/payload-types'

// export const Users: CollectionConfig = {
//   slug: 'users',
//   access: {
//     admin: authenticated,
//     create: canManageUsers, // Only admin can create users
//     delete: canManageUsers, // Only admin can delete users
//     read: canReadUsers, // As defined above
//     update: canUpdateUsers, // Admin: any user, Non-admin: only self
//   },
//   admin: {
//     defaultColumns: ['name', 'email', 'role'],
//     useAsTitle: 'name',
//   },
//   auth: true, // adds email + password fields
//   fields: [
//     {
//       name: 'name',
//       type: 'text',
//     },
//     {
//       name: 'role',
//       type: 'select',
//       options: [
//         { label: 'Admin', value: 'admin' },
//         { label: 'Editor', value: 'editor' },
//         { label: 'Contributor', value: 'contributor' },
//         { label: 'Viewer', value: 'viewer' },
//         { label: 'Analyst', value: 'analyst' },
//       ],
//       defaultValue: 'admin',
//       required: true,
//       /**
//        * Lock role for non-admins:
//        * - Field-level access: only admins can update this field (API-level)
//        */
//       access: {
//         update: ({ req }) => Boolean(req.user && (req.user as User).role === 'admin'),
//       },
//       admin: {
//         description:
//           'User role determines access permissions. Only admins can change roles. All existing users default to admin.',
//         position: 'sidebar',
//         // NOTE: readOnly must be a boolean in this Payload version.
//         // We rely on access.update above to enforce that only admins
//         // can actually change this field.
//       },
//     },
//   ],
//   timestamps: true,
// }
import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { canManageUsers, canReadUsers, canUpdateUsers } from '@/access/role'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: canManageUsers, // Only admin can create users
    delete: canManageUsers, // Only admin can delete users
    read: canReadUsers, // As defined in access/role.ts
    update: canUpdateUsers, // Admin: any; non-admin: only self
  },
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    useAsTitle: 'name',
  },
  auth: true, // adds email + password

  fields: [
    // Email is added automatically by auth: true,
    // we redefine it here only to add field-level access.
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
