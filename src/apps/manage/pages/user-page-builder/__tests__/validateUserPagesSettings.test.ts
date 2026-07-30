import { describe, expect, it } from 'vitest'

import type { UserPagesSettingsV1 } from '@/apps/user-page/types'

import { validateRenderableUserPagesSettings, validateUserPagesSettings } from '../validateUserPagesSettings'

describe('user page structured validation', () => {
  it('keeps page, block and field locations for every issue', () => {
    const settings: UserPagesSettingsV1 = {
      version: 1,
      home: { mode: 'legacy' },
      pages: {
        links: {
          mode: 'block',
          block: {
            version: 1,
            blocks: [
              {
                id: 'layout',
                type: 'layout',
                props: {
                  layout: 'column',
                  children: [
                    {
                      id: 'links',
                      type: 'links',
                      props: { items: [{ label: '', url: 'http://invalid.example' }] },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }

    const issues = validateUserPagesSettings(settings)

    expect(issues).toContainEqual(
      expect.objectContaining({
        scope: 'block',
        pageKey: 'links',
        blockId: 'links',
        fieldPath: 'items[0].url',
      }),
    )
    expect(issues.filter((issue) => issue.blockId === 'links').length).toBeGreaterThan(1)
  })

  it('returns global issues without encoding location into the message', () => {
    const settings = {
      version: 1,
      home: { mode: 'legacy' },
      pages: {},
      background: { pageBackgroundType: 'invalid' },
    } as unknown as UserPagesSettingsV1

    expect(validateUserPagesSettings(settings)).toContainEqual(
      expect.objectContaining({
        scope: 'settings',
        pageKey: null,
        blockId: null,
        fieldPath: 'background.pageBackgroundType',
      }),
    )
  })

  it('does not include hidden block errors in publish validation', () => {
    const settings = {
      version: 1,
      home: {
        mode: 'block',
        block: {
          version: 1,
          blocks: [{ id: 'hidden', type: 'not-registered', hidden: true, props: null }],
        },
      },
      pages: {},
    } as unknown as UserPagesSettingsV1

    expect(validateUserPagesSettings(settings)).not.toHaveLength(0)
    expect(validateRenderableUserPagesSettings(settings)).toHaveLength(0)
  })
})
