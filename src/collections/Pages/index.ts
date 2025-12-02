import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { Archive } from '../../blocks/ArchiveBlock/config'
import { CallToAction } from '../../blocks/CallToAction/config'
import { Content } from '../../blocks/Content/config'
import { FormBlock } from '../../blocks/Form/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { hero } from '@/heros/config'
import { slugField } from 'payload'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateDelete, revalidatePage } from './hooks/revalidatePage'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { canCreate, canDelete, canUpdate, restrictAnalystAccess } from '@/access/role'
import { restrictPublish } from '@/hooks/restrictPublish'
import type { User } from '@/payload-types'

/**
 * Hook to automatically set/keep createdBy on pages
 */
const setCreatedBy: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  const user = req.user as User | undefined
  if (!user) return data

  // On create, always set createdBy to current user
  if (operation === 'create') {
    return {
      ...data,
      createdBy: user.id,
    }
  }

  // On update, preserve existing createdBy if present
  const existingCreatedBy = (originalDoc as any)?.createdBy
  if (existingCreatedBy) {
    return {
      ...data,
      createdBy: existingCreatedBy,
    }
  }

  // If for some reason there was no createdBy, set it now
  return {
    ...data,
    createdBy: user.id,
  }
}

export const Pages: CollectionConfig<'pages'> = {
  slug: 'pages',
  access: {
    create: canCreate,
    delete: canDelete('pages'),
    update: canUpdate('pages'),
    read: authenticatedOrPublished,
    admin: restrictAnalystAccess,
  },
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'pages',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'pages',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    // Track who created the page
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'User who originally created this page.',
      },
      access: {
        // Only set via hooks; user cannot change directly
        create: () => false,
        update: () => false,
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock, Archive, FormBlock],
              required: true,
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              hasGenerateFn: true,
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    slugField(),
  ],
  hooks: {
    beforeChange: [setCreatedBy, restrictPublish('pages'), populatePublishedAt],
    afterChange: [revalidatePage],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100,
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
