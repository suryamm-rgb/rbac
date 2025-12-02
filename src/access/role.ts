// access/role.ts

import type { Access, AccessArgs, CollectionSlug } from 'payload'
import type { User } from '@/payload-types'

/**
 * Check if user has one of the specified role
 */
export const hasRole = (role: string[]) => {
  return ({ req: { user } }: AccessArgs<User>): boolean => {
    if (!user) return false
    const userRole = user.role
    if (!userRole) return false
    return role.includes(userRole)
  }
}

// Admin only access
export const isAdmin: Access = hasRole(['admin'])

export const AdminOrEditor: Access = hasRole(['admin', 'editor'])

export const canReadSubmissions: Access = hasRole(['admin', 'editor', 'analyst'])

/**
 * Can delete documents:
 * - Admin: any document
 * - Editor/Contributor: only documents they created (via `createdBy`)
 */
export const canDelete = (collection: CollectionSlug): Access => {
  return async ({ req: { user, payload }, id }) => {
    if (!user) return false

    // Admin can delete anything
    if (user.role === 'admin') return true

    if (!id) return false // Need a document ID to delete

    const doc = (await payload.findByID({
      collection,
      id: typeof id === 'string' ? id : String(id),
      depth: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any

    const createdById =
      typeof doc?.createdBy === 'string' ? doc.createdBy : doc?.createdBy?.id || doc?.createdBy

    if (!createdById) {
      // No createdBy: treat as protected (only admin can delete, already handled above)
      return false
    }

    return String(createdById) === String(user.id)
  }
}

/**
 * Can update documents:
 * - Admin: any document
 * - Editor:
 *   - can create new documents
 *   - can update their own documents
 *   - can update documents created by Contributors
 * - Contributor:
 *   - can create new documents
 *   - can update their own documents
 */
export const canUpdate = (collection: CollectionSlug): Access => {
  return async ({ req: { user, payload }, id }) => {
    if (!user) return false

    // Admin can update anything
    if (user.role === 'admin') return true

    const role = user.role

    // Creating new document
    if (!id) {
      // Editors and Contributors can create
      if (role === 'editor' || role === 'contributor') return true
      return false
    }

    const doc = (await payload.findByID({
      collection,
      id: typeof id === 'string' ? id : String(id),
      depth: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any

    const createdById =
      typeof doc?.createdBy === 'string' ? doc.createdBy : doc?.createdBy?.id || doc?.createdBy

    // No createdBy -> treat as protected, only admin can touch (already handled above)
    if (!createdById) return false

    const currentUserId = String(user.id)

    if (role === 'editor') {
      // Editors can update their own documents
      if (String(createdById) === currentUserId) return true

      // Editors can update documents created by Contributors
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

    if (role === 'contributor') {
      // Contributors can update only their own documents
      return String(createdById) === currentUserId
    }

    // Viewers / Analysts: no update
    return false
  }
}

// Can create documents
export const canCreate: Access = hasRole(['admin', 'editor', 'contributor'])

// Can publish documents (currently: only Admin)
// export const canPublish: Access = hasRole(['admin', 'editor'])

// User management access
export const canManageUsers = ({ req: { user } }: AccessArgs<User>): boolean => {
  return Boolean(user && user.role === 'admin')
}

export const canReadUsers: Access = ({ req: { user }, id }) => {
  if (!user) return false

  // Admin and Editor can read any user
  if (['editor', 'admin'].includes(user.role || '')) {
    return true
  }

  // Non-admin/editor:
  // If no ID, restrict list to own user
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

export const canUpdateUsers: Access = ({ req: { user }, id }) => {
  if (!user) return false

  // Admin can update any user
  if (user.role === 'admin') return true

  // Non-admin: can only update themselves
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
 * Prevent Analysts from accessing the admin UI for collections
 */
export const restrictAnalystAccess = ({ req: { user } }: AccessArgs<User>): boolean => {
  if (!user) return false
  if (user.role === 'analyst') return false
  return true
}
