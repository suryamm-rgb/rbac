// import type { Access, AccessArgs, CollectionSlug } from 'payload'

// import type { User } from '@/payload-types'

// /**
//  * Check if user has one of the specified roles
//  */
// export const hasRole = (roles: string[]) => {
//   return ({ req: { user } }: AccessArgs<User>): boolean => {
//     if (!user) return false
//     return roles.includes(user.role)
//   }
// }

// /**
//  * Admin only access
//  */
// export const adminOnly: Access = hasRole(['admin'])

// /**
//  * Admin or Editor access
//  */
// export const adminOrEditor: Access = hasRole(['admin', 'editor'])

// /**
//  * Admin, Editor, or Analyst read access (for submission collections)
//  */
// export const canReadSubmissions: Access = hasRole(['admin', 'editor', 'analyst'])

// /**
//  * Can delete documents
//  * - Admin: can delete anything
//  * - Editor: can delete own documents OR legacy documents (no createdBy)
//  * - Contributor: can delete own documents OR legacy documents (no createdBy)
//  * - Viewer: cannot delete
//  */
// export const canDelete = (collection: CollectionSlug): Access => {
//   return async ({ req: { user, payload }, id }) => {
//     if (!user) return false

//     // Admin can delete anything
//     if (user.role === 'admin') return true

//     // Editor and Contributor can delete own documents OR legacy documents (no createdBy)
//     if (['editor', 'contributor'].includes(user.role || '')) {
//       if (!id) return false // Cannot delete if no document ID

//       const doc = (await payload.findByID({
//         collection,
//         id: typeof id === 'string' ? id : String(id),
//         depth: 0, // Don't populate relationships to avoid issues
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       })) as any // Type assertion needed since createdBy is optional on some collections

//       // Legacy documents (no createdBy): allow delete
//       // This handles 1500+ existing pages gracefully
//       if (!doc?.createdBy) {
//         return true
//       }

//       // New documents: check ownership
//       // Handle both string ID and populated relationship object
//       const createdById =
//         typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

//       // Compare as strings to handle both string and number IDs
//       return String(createdById) === String(user.id)
//     }

//     return false
//   }
// }

// /**
//  * Can update documents
//  * - Admin: can update anything
//  * - Editor: can update own documents, Contributor documents, OR legacy documents (no createdBy)
//  * - Contributor: can update own documents OR legacy documents (no createdBy)
//  * - Viewer: cannot update
//  */
// export const canUpdate = (collection: CollectionSlug): Access => {
//   return async ({ req: { user, payload }, id }) => {
//     if (!user) return false

//     // Admin can update anything
//     if (user.role === 'admin') return true

//     // Editor can update own documents, Contributor documents, or legacy documents
//     if (user.role === 'editor') {
//       if (!id) return true // Creating new document

//       const doc = (await payload.findByID({
//         collection,
//         id: typeof id === 'string' ? id : id ? String(id) : '',
//         depth: 0, // Don't populate relationships to avoid issues
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       })) as any // Type assertion needed since createdBy is optional on some collections

//       // Legacy documents (no createdBy): allow update
//       if (!doc?.createdBy) {
//         return true
//       }

//       // Editors can update their own documents OR documents created by Contributors
//       // Need to check the creator's role
//       const createdById =
//         typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

//       const currentUserId = String(user.id)

//       // If it's their own document, allow
//       if (String(createdById) === currentUserId) {
//         return true
//       }

//       // If created by someone else, check if creator is a Contributor
//       // Editors can edit Contributor documents (but not other Editor/Admin documents)
//       try {
//         const creator = await payload.findByID({
//           collection: 'users',
//           id: String(createdById),
//           depth: 0,
//         })

//         // Allow if creator is a Contributor (Editors can edit Contributor work)
//         const creatorUser = creator as User
//         if (creatorUser && creatorUser.role === 'contributor') {
//           return true
//         }
//       } catch {
//         // If we can't fetch creator, be safe and deny
//         return false
//       }

//       return false
//     }

//     // Contributor can update own documents OR legacy documents (no createdBy)
//     if (user.role === 'contributor') {
//       if (!id) return true // Creating new document

//       const doc = (await payload.findByID({
//         collection,
//         id: typeof id === 'string' ? id : id ? String(id) : '',
//         depth: 0, // Don't populate relationships to avoid issues
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       })) as any // Type assertion needed since createdBy is optional on some collections

//       // Legacy documents (no createdBy): allow update
//       if (!doc?.createdBy) {
//         return true
//       }

//       // New documents: check ownership - Contributors can only update their own
//       const createdById =
//         typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

//       // Compare as strings to handle both string and number IDs
//       return String(createdById) === String(user.id)
//     }

//     return false
//   }
// }

// /**
//  * Can create documents
//  * - Admin, Editor, Contributor: can create
//  * - Viewer: cannot create
//  */
// export const canCreate: Access = hasRole(['admin', 'editor', 'contributor'])

// /**
//  * Can publish documents (admin and editor only)
//  * Note: This is used for access control, actual publish restriction is handled via hooks
//  */
// export const canPublish: Access = hasRole(['admin', 'editor'])

// /**
//  * User management (admin only)
//  * Returns boolean for Users collection access
//  */
// export const canManageUsers = ({ req: { user } }: AccessArgs<User>): boolean => {
//   return Boolean(user && user.role === 'admin')
// }

// /**
//  * Can read users
//  * - Admin: can read all users (for user management)
//  * - Editor/Contributor: can read user records (needed to populate relationship fields)
//  * - Analyst: can read their own user record only
//  * - Any authenticated user: can read their own user record (required for login/auth)
//  *
//  * Note: Payload's login endpoint bypasses collection access control for authentication.
//  * This function handles post-login access (e.g., /api/users/me, /api/users/:id)
//  *
//  * For relationship population: Editors and Contributors need to read user records
//  * that are referenced in createdBy fields of documents they can access.
//  * We allow reading individual user records (by ID) but restrict listing to prevent
//  * non-admins from seeing all users in the admin panel.
//  *
//  * IMPORTANT: When Payload populates relationship fields, it may use queries or direct ID lookups.
//  * We need to allow Editors/Contributors to read user records to ensure relationships display correctly.
//  */
// export const canReadUsers: Access = ({ req: { user }, id }) => {
//   if (!user) return false

//   // Admin can read all users
//   if (user.role === 'admin') return true

//   // Editors and Contributors can read user records
//   // This is essential for relationship field population (createdBy, etc.)
//   // Without this, relationship fields show "Untitled - ID: xxx" instead of the user's name
//   if (['editor', 'contributor'].includes(user.role || '')) {
//     // Always allow reading user records for Editors/Contributors
//     // This ensures relationship fields can be populated properly
//     // The restriction on listing (below) prevents them from seeing all users in the admin panel
//     return true
//   }

//   // Analyst and other roles (Viewer, etc.) can only read own record
//   if (!id) {
//     return {
//       id: {
//         equals: user.id,
//       },
//     }
//   }

//   // id provided - check if it matches current user's id
//   const userId = typeof id === 'string' ? id : id !== undefined ? String(id) : ''
//   const currentUserId = typeof user.id === 'string' ? user.id : String(user.id)

//   return userId === currentUserId
// }

// /**
//  * Admin panel access control for non-submission collections
//  * - Admin, Editor, Contributor, Viewer: can access
//  * - Analyst: cannot access (should only see submission collections)
//  * Note: admin access must return boolean, not AccessResult
//  */
// export const restrictAnalystAccess = ({ req: { user } }: AccessArgs<User>): boolean => {
//   if (!user) return false
//   // Deny Analyst access to non-submission collections
//   if (user.role === 'analyst') return false
//   // Allow all other roles
//   return true
// }

// import type { Access, AccessArgs, CollectionSlug } from 'payload'

// import type { User } from '@/payload-types'

// /**
//  * Check if user has one of the specified roles
//  */
// export const hasRole = (roles: string[]) => {
//   return ({ req: { user } }: AccessArgs<User>): boolean => {
//     if (!user) return false
//     return roles.includes(user.role)
//   }
// }

// /**
//  * Admin only access
//  */
// export const adminOnly: Access = hasRole(['admin'])

// /**
//  * Admin or Editor access
//  */
// export const adminOrEditor: Access = hasRole(['admin', 'editor'])

// /**
//  * Admin, Editor, or Analyst read access (for submission collections)
//  */
// export const canReadSubmissions: Access = hasRole(['admin', 'editor', 'analyst'])

// /**
//  * Can delete documents
//  * - Admin: can delete anything
//  * - Editor: can delete own documents OR legacy documents (no createdBy)
//  * - Contributor: can delete own documents OR legacy documents (no createdBy)
//  * - Viewer: cannot delete
//  */
// export const canDelete = (collection: CollectionSlug): Access => {
//   return async ({ req: { user, payload }, id }) => {
//     if (!user) return false

//     // Admin can delete anything
//     if (user.role === 'admin') return true

//     // Editor and Contributor can delete own documents OR legacy documents (no createdBy)
//     if (['editor', 'contributor'].includes(user.role || '')) {
//       if (!id) return false // Cannot delete if no document ID

//       const doc = (await payload.findByID({
//         collection,
//         id: typeof id === 'string' ? id : String(id),
//         depth: 0, // Don't populate relationships to avoid issues
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       })) as any // Type assertion needed since createdBy is optional on some collections

//       // Legacy documents (no createdBy): allow delete
//       // This handles 1500+ existing pages gracefully
//       if (!doc?.createdBy) {
//         return true
//       }

//       // New documents: check ownership
//       // Handle both string ID and populated relationship object
//       const createdById =
//         typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

//       // Compare as strings to handle both string and number IDs
//       return String(createdById) === String(user.id)
//     }

//     return false
//   }
// }

// /**
//  * Can update documents
//  * - Admin: can update anything
//  * - Editor: can update own documents, Contributor documents, OR legacy documents (no createdBy)
//  * - Contributor: can update own documents OR legacy documents (no createdBy)
//  * - Viewer: cannot update
//  */
// export const canUpdate = (collection: CollectionSlug): Access => {
//   return async ({ req: { user, payload }, id }) => {
//     if (!user) return false

//     // Admin can update anything
//     if (user.role === 'admin') return true

//     // Editor can update own documents, Contributor documents, or legacy documents
//     if (user.role === 'editor') {
//       if (!id) return true // Creating new document

//       const doc = (await payload.findByID({
//         collection,
//         id: typeof id === 'string' ? id : id ? String(id) : '',
//         depth: 0, // Don't populate relationships to avoid issues
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       })) as any // Type assertion needed since createdBy is optional on some collections

//       // Legacy documents (no createdBy): allow update
//       if (!doc?.createdBy) {
//         return true
//       }

//       // Editors can update their own documents OR documents created by Contributors
//       // Need to check the creator's role
//       const createdById =
//         typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

//       const currentUserId = String(user.id)

//       // If it's their own document, allow
//       if (String(createdById) === currentUserId) {
//         return true
//       }

//       // If created by someone else, check if creator is a Contributor
//       // Editors can edit Contributor documents (but not other Editor/Admin documents)
//       try {
//         const creator = await payload.findByID({
//           collection: 'users',
//           id: String(createdById),
//           depth: 0,
//         })

//         // Allow if creator is a Contributor (Editors can edit Contributor work)
//         const creatorUser = creator as User
//         if (creatorUser && creatorUser.role === 'contributor') {
//           return true
//         }
//       } catch {
//         // If we can't fetch creator, be safe and deny
//         return false
//       }

//       return false
//     }

//     // Contributor can update own documents OR legacy documents (no createdBy)
//     if (user.role === 'contributor') {
//       if (!id) return true // Creating new document

//       const doc = (await payload.findByID({
//         collection,
//         id: typeof id === 'string' ? id : id ? String(id) : '',
//         depth: 0, // Don't populate relationships to avoid issues
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       })) as any // Type assertion needed since createdBy is optional on some collections

//       // Legacy documents (no createdBy): allow update
//       if (!doc?.createdBy) {
//         return true
//       }

//       // New documents: check ownership - Contributors can only update their own
//       const createdById =
//         typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

//       // Compare as strings to handle both string and number IDs
//       return String(createdById) === String(user.id)
//     }

//     return false
//   }
// }

// /**
//  * Can create documents
//  * - Admin, Editor, Contributor: can create
//  * - Viewer: cannot create
//  */
// export const canCreate: Access = hasRole(['admin', 'editor', 'contributor'])

// /**
//  * Can publish documents (admin and editor only)
//  * Note: This is used for access control, actual publish restriction is handled via hooks
//  */
// export const canPublish: Access = hasRole(['admin', 'editor'])

// /**
//  * User management (admin only)
//  * Returns boolean for Users collection access
//  */
// export const canManageUsers = ({ req: { user } }: AccessArgs<User>): boolean => {
//   return Boolean(user && user.role === 'admin')
// }

// /**
//  * Can read users
//  * - Admin: can read all users (for user management)
//  * - Editor/Contributor: can read user records (needed to populate relationship fields)
//  * - Analyst: can read their own user record only
//  * - Any authenticated user: can read their own user record (required for login/auth)
//  */
// export const canReadUsers: Access = ({ req: { user }, id }) => {
//   if (!user) return false

//   // Admin can read all users
//   if (user.role === 'admin') return true

//   // Editors and Contributors can read user records (for relationship population)
//   if (['editor', 'contributor'].includes(user.role || '')) {
//     return true
//   }

//   // Analyst and other roles (Viewer, etc.) can only read own record
//   if (!id) {
//     return {
//       id: {
//         equals: user.id,
//       },
//     }
//   }

//   // id provided - check if it matches current user's id
//   const userId = typeof id === 'string' ? id : id !== undefined ? String(id) : ''
//   const currentUserId = typeof user.id === 'string' ? user.id : String(user.id)

//   return userId === currentUserId
// }

// /**
//  * Can update users
//  * - Admin: can update any user (including role)
//  * - Any authenticated non-admin: can update ONLY their own user record
//  *   (e.g., password, name). Role is further locked by field-level access.
//  */
// export const canUpdateUsers: Access = ({ req: { user }, id }) => {
//   if (!user) return false

//   // Admin can update any user
//   if (user.role === 'admin') return true

//   // For non-admins, only allow updating their own record
//   if (!id) {
//     // No id in request — restrict to own document via where clause
//     return {
//       id: {
//         equals: user.id,
//       },
//     }
//   }

//   const targetId = typeof id === 'string' ? id : String(id)
//   const currentUserId = typeof user.id === 'string' ? user.id : String(user.id)

//   return targetId === currentUserId
// }

// /**
//  * Admin panel access control for non-submission collections
//  * - Admin, Editor, Contributor, Viewer: can access
//  * - Analyst: cannot access (should only see submission collections)
//  * Note: admin access must return boolean, not AccessResult
//  */
// export const restrictAnalystAccess = ({ req: { user } }: AccessArgs<User>): boolean => {
//   if (!user) return false
//   // Deny Analyst access to non-submission collections
//   if (user.role === 'analyst') return false
//   // Allow all other roles
//   return true
// }
import type { Access, AccessArgs, CollectionSlug } from 'payload'
import type { User } from '@/payload-types'

/**
 * Check if user has one of the specified roles
 */
export const hasRole = (roles: string[]) => {
  return ({ req: { user } }: AccessArgs<User>): boolean => {
    if (!user) return false
    return roles.includes(user.role)
  }
}

/**
 * Admin only access
 */
export const adminOnly: Access = hasRole(['admin'])

/**
 * Admin or Editor access
 */
export const adminOrEditor: Access = hasRole(['admin', 'editor'])

/**
 * Admin, Editor, or Analyst read access (for submission collections)
 */
export const canReadSubmissions: Access = hasRole(['admin', 'editor', 'analyst'])

/**
 * Can delete documents
 * - Admin: can delete anything
 * - Editor: can delete own documents OR legacy documents (no createdBy)
 * - Contributor: can delete own documents OR legacy documents (no createdBy)
 * - Viewer: cannot delete
 */
export const canDelete = (collection: CollectionSlug): Access => {
  return async ({ req: { user, payload }, id }) => {
    if (!user) return false

    // Admin can delete anything
    if (user.role === 'admin') return true

    // Editor and Contributor can delete own documents OR legacy documents (no createdBy)
    if (['editor', 'contributor'].includes(user.role || '')) {
      if (!id) return false // Cannot delete if no document ID

      const doc = (await payload.findByID({
        collection,
        id: typeof id === 'string' ? id : String(id),
        depth: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any

      // Legacy documents (no createdBy): allow delete
      if (!doc?.createdBy) {
        return true
      }

      // New documents: check ownership
      const createdById =
        typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

      return String(createdById) === String(user.id)
    }

    return false
  }
}

/**
 * Can update documents
 * - Admin: can update anything
 * - Editor: can update own documents, Contributor documents, OR legacy documents (no createdBy)
 * - Contributor: can update own documents OR legacy documents (no createdBy)
 * - Viewer: cannot update
 */
export const canUpdate = (collection: CollectionSlug): Access => {
  return async ({ req: { user, payload }, id }) => {
    if (!user) return false

    // Admin can update anything
    if (user.role === 'admin') return true

    // Editor can update own documents, Contributor documents, or legacy documents
    if (user.role === 'editor') {
      if (!id) return true // Creating new document

      const doc = (await payload.findByID({
        collection,
        id: typeof id === 'string' ? id : id ? String(id) : '',
        depth: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any

      // Legacy documents (no createdBy): allow update
      if (!doc?.createdBy) {
        return true
      }

      const createdById =
        typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

      const currentUserId = String(user.id)

      // Editors can update their own documents
      if (String(createdById) === currentUserId) {
        return true
      }

      // Or documents created by Contributors
      try {
        const creator = await payload.findByID({
          collection: 'users',
          id: String(createdById),
          depth: 0,
        })

        const creatorUser = creator as User
        if (creatorUser && creatorUser.role === 'contributor') {
          return true
        }
      } catch {
        return false
      }

      return false
    }

    // Contributor can update own documents OR legacy documents (no createdBy)
    if (user.role === 'contributor') {
      if (!id) return true // Creating new document

      const doc = (await payload.findByID({
        collection,
        id: typeof id === 'string' ? id : id ? String(id) : '',
        depth: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any

      if (!doc?.createdBy) {
        return true
      }

      const createdById =
        typeof doc.createdBy === 'string' ? doc.createdBy : doc.createdBy?.id || doc.createdBy

      return String(createdById) === String(user.id)
    }

    return false
  }
}

/**
 * Can create documents
 * - Admin, Editor, Contributor: can create
 * - Viewer: cannot create
 */
export const canCreate: Access = hasRole(['admin', 'editor', 'contributor'])

/**
 * Can publish documents (admin and editor only)
 */
export const canPublish: Access = hasRole(['admin', 'editor'])

/**
 * User management (admin only)
 * Returns boolean for Users collection access
 */
export const canManageUsers = ({ req: { user } }: AccessArgs<User>): boolean => {
  return Boolean(user && user.role === 'admin')
}

/**
 * Can read users
 * - Admin: can read all users
 * - Editor/Contributor: can read user records (for relationship population)
 * - Analyst/Viewer/etc: can read only their own record
 */
export const canReadUsers: Access = ({ req: { user }, id }) => {
  if (!user) return false

  if (user.role === 'admin') return true

  if (['editor'].includes(user.role || '')) {
    return true
  }

  if (!id) {
    return {
      id: {
        equals: user.id,
      },
    }
  }

  const userId = typeof id === 'string' ? id : id !== undefined ? String(id) : ''
  const currentUserId = typeof user.id === 'string' ? user.id : String(user.id)

  return userId === currentUserId
}

/**
 * Can update users
 * - Admin: can update any user (including role/email)
 * - Non-admin: can update ONLY their own user record
 */
export const canUpdateUsers: Access = ({ req: { user }, id }) => {
  if (!user) return false

  if (user.role === 'admin') return true

  if (!id) {
    return {
      id: {
        equals: user.id,
      },
    }
  }

  const targetId = typeof id === 'string' ? id : String(id)
  const currentUserId = typeof user.id === 'string' ? user.id : String(user.id)

  return targetId === currentUserId
}

/**
 * Admin panel access control for non-submission collections
 * - Admin, Editor, Contributor, Viewer: can access
 * - Analyst: cannot access
 */
export const restrictAnalystAccess = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  if (user.role === 'analyst') return false
  return true
}
