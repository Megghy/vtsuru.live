import { describe, expect, it } from 'vitest'

import { createDefaultCustomPageProps } from '@/apps/user-page/block/customHtmlContract'
import type { UserPagesSettings } from '@/apps/user-page/types'

import { validateRenderableUserPagesSettings, validateUserPagesSettings } from '../validateUserPagesSettings'

describe('user page structured validation', () => {
  it('keeps page, block and field locations for every issue', () => {
    const settings: UserPagesSettings = {
      version: 2,
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
      version: 2,
      home: { mode: 'legacy' },
      pages: {},
      background: { pageBackgroundType: 'invalid' },
    } as unknown as UserPagesSettings

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
      version: 2,
      home: {
        mode: 'block',
        block: {
          version: 1,
          blocks: [{ id: 'hidden', type: 'not-registered', hidden: true, props: null }],
        },
      },
      pages: {},
    } as unknown as UserPagesSettings

    expect(validateUserPagesSettings(settings)).not.toHaveLength(0)
    expect(validateRenderableUserPagesSettings(settings)).toHaveLength(0)
  })

  it('uses the block contract for custom pages and reports invalid fields', () => {
    const custom = createDefaultCustomPageProps() as unknown as Record<string, unknown>
    custom.heightMode = 'invalid'
    custom.immersive = 'yes'
    custom.assets = [{ key: 'bad key', file: { id: 0, path: '/a' } }]
    const settings = { version: 2, home: { mode: 'custom', custom }, pages: {} } as unknown as UserPagesSettings

    const paths = validateUserPagesSettings(settings).map((issue) => issue.fieldPath)

    expect(paths).toContain('custom.heightMode')
    expect(paths).toContain('custom.immersive')
    expect(paths).toContain('custom.assets[0].key')
    expect(paths).toContain('custom.assets[0].file')
    expect(paths).not.toContain('custom.source')
  })

  it('inspects custom Vue style blocks after structural validation', () => {
    const custom = createDefaultCustomPageProps()
    custom.source = '<style>@import url(https://evil.example/a.css);</style>'
    const settings: UserPagesSettings = { version: 2, home: { mode: 'custom', custom }, pages: {} }

    const paths = validateUserPagesSettings(settings).map((issue) => issue.fieldPath)

    expect(paths.some((path) => path?.startsWith('custom.css:'))).toBe(true)
  })

  it('enforces the shared asset and UTF-8 source limits', () => {
    const custom = createDefaultCustomPageProps()
    custom.assets = Array.from({ length: 100 }, (_, index) => ({
      key: `asset-${index}`,
      file: { id: index + 1, path: `/file/${index + 1}` } as any,
    }))
    const settings: UserPagesSettings = { version: 2, home: { mode: 'custom', custom }, pages: {} }
    expect(validateUserPagesSettings(settings)).toHaveLength(0)

    custom.assets.push({ key: 'asset-100', file: { id: 101, path: '/file/101' } as any })
    custom.source = '中'.repeat(Math.floor((512 * 1024) / 3)) + 'aaa'
    const paths = validateUserPagesSettings(settings).map((issue) => issue.fieldPath)
    expect(paths).toContain('custom.assets')
    expect(paths).toContain('custom.source')
  })
})
