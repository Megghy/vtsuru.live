import { describe, expect, it } from 'vitest'

import { migrateUserPagesSettings } from '../normalize'

describe('migrateUserPagesSettings', () => {
  it('把无版本历史配置迁移到当前版本且不修改输入', () => {
    const legacy = {
      home: {
        mode: 'block',
        block: { blocks: [{ id: 'countdown', type: 'countdown', props: { target: 1_700_000_000 } }] },
      },
    }
    const migrated = migrateUserPagesSettings(legacy)

    expect(legacy).not.toHaveProperty('version')
    expect(migrated.version).toBe(2)
    expect(migrated.home?.block?.version).toBe(1)
    const countdown = migrated.home.block.blocks[0]
    expect((countdown.props as any).target).toBe('2023-11-14T22:13:20.000Z')
  })

  it('迁移是幂等纯函数', () => {
    const source = { version: 2, pages: {}, home: { mode: 'legacy' } }
    const once = migrateUserPagesSettings(source)
    const twice = migrateUserPagesSettings(once)
    expect(twice).toEqual(once)
    expect(once).not.toBe(source)
  })

  it('拒绝未来版本和无效根节点', () => {
    expect(() => migrateUserPagesSettings({ version: 3 })).toThrow('version 不支持')
    expect(() => migrateUserPagesSettings({ version: '1', pages: {} })).toThrow('version 不支持')
    expect(() => migrateUserPagesSettings({ version: 2 })).toThrow('缺少 home 或 pages')
    expect(() => migrateUserPagesSettings({ version: 2, pages: [] })).toThrow('pages 必须是 object')
    expect(() => migrateUserPagesSettings({ version: 2, pages: { broken: { mode: 'unknown' } } })).toThrow(
      'mode 不支持',
    )
    expect(() => migrateUserPagesSettings([])).toThrow('必须是 object')
  })

  it('只在 v1 迁移时删除旧编辑器写入的默认主色', () => {
    const migrated = migrateUserPagesSettings({
      version: 1,
      pages: {
        now: { mode: 'block', block: { version: 1, theme: { primaryColor: '#18a058' }, blocks: [] } },
      },
    })
    const current = migrateUserPagesSettings({
      version: 2,
      pages: {
        now: { mode: 'block', block: { version: 1, theme: { primaryColor: '#18a058' }, blocks: [] } },
      },
    })

    expect(migrated.pages?.now.block?.theme).toBeUndefined()
    expect(current.pages?.now.block?.theme?.primaryColor).toBe('#18a058')
  })
})
