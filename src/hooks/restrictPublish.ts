import { APIError, type CollectionBeforeChangeHook, type CollectionSlug } from 'payload'

/**
 * Restricts publishing to Admin and Editor roles only
 * Contributors and Viewers cannot publish documents
 *
 * @param collectionSlug - The collection slug to restrict publishing for
 * @returns CollectionBeforeChangeHook
 */
export const restrictPublish = (collectionSlug: CollectionSlug): CollectionBeforeChangeHook => {
  return async ({ data, req, operation }) => {
    const user = req.user

    // Allow if admin or editor - they can publish/unpublish freely
    if (user?.role === 'admin' || user?.role === 'editor') {
      return data
    }

    // For contributors and viewers, prevent publishing and un publishing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incomingStatus = (data as any)?._status

    // For update operations, always check the existing document status
    if (operation === 'update' && data && data.id) {
      try {
        // Get the existing document to check current status
        const existing = (await req.payload.findByID({
          collection: collectionSlug,
          id: typeof data.id === 'string' ? data.id : data.id.toString(),
          depth: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any // Type assertion needed since _status is optional on some collections

        const existingStatus = existing?._status || 'draft'

        // If document was already published, keep it published (prevent unpublishing)
        if (existingStatus === 'published') {
          return {
            ...data,
            _status: 'published', // Keep it published - contributors can edit but not unpublish
          }
        }

        // CRITICAL: Prevent any transition to 'published' status
        // If incoming status is 'published' and existing is NOT published, block it
        if (incomingStatus === 'published' && existingStatus !== 'published') {
          // Throw APIError to prevent publishing - this ensures proper error handling in frontend
          throw new APIError(
            'You do not have permission to publish documents. Only Admin and Editor roles can publish.',
            403,
          )
        }

        // If incoming status is explicitly 'published', always prevent it for non-admin/editor
        if (incomingStatus === 'published') {
          throw new APIError(
            'You do not have permission to publish documents. Only Admin and Editor roles can publish.',
            403,
          )
        }

        // If no status in incoming data, preserve existing status
        // But ensure it can't become 'published' if it wasn't already
        if (!incomingStatus) {
          return {
            ...data,
            _status: existingStatus === 'published' ? 'published' : existingStatus || 'draft',
          }
        }
      } catch (_fetchError) {
        // If we can't fetch existing document, be safe and prevent publishing
        req.payload.logger.warn(
          `restrictPublish: Could not fetch existing document, preventing publish for ${user?.role}`,
        )
        if (incomingStatus === 'published') {
          // Throw APIError to prevent publishing when we can't verify existing status
          throw new APIError(
            'You do not have permission to publish documents. Only Admin and Editor roles can publish.',
            403,
          )
        }
      }
    }

    // For create operations, ensure contributors/viewers can't create as published
    if (operation === 'create') {
      if (incomingStatus === 'published') {
        throw new APIError(
          'You do not have permission to publish documents. Only Admin and Editor roles can publish.',
          403,
        )
      }
      // Ensure new documents default to draft
      return {
        ...data,
        _status: incomingStatus || 'draft',
      }
    }

    // Final safety check: if status is 'published' for non-admin/editor, throw error
    if (incomingStatus === 'published') {
      throw new APIError(
        'You do not have permission to publish documents. Only Admin and Editor roles can publish.',
        403,
      )
    }

    return data
  }
}
