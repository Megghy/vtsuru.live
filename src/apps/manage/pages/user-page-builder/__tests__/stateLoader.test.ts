import { describe, expect, it } from 'vitest'

import type { UserPagesSettings } from '@/apps/user-page/types'

import { getUserPagesLocalDraftKey } from '../useUserPagesLocalDraftStorage'
import { selectInitialSettings } from '../useUserPageStateLoader'

const published: UserPagesSettings = {
  version: 2,
  home: { mode: 'legacy' },
  pages: {},
}

function localDraft(settings: UserPagesSettings, base: UserPagesSettings = published) {
  return { settings, baseSnapshot: JSON.stringify(base) }
}

describe('user page local draft recovery', () => {
  it('账号 key 相互隔离', () => {
    expect(getUserPagesLocalDraftKey(1)).not.toBe(getUserPagesLocalDraftKey(2))
  })

  it('本地内容与服务端不同时恢复本地内容并保持未保存状态', () => {
    const local: UserPagesSettings = {
      ...published,
      pages: { works: { mode: 'legacy', title: '本地修改' } },
    }
    const selected = selectInitialSettings({ draft: null, published, rollback: null }, localDraft(local))

    expect(selected.settings).toBe(local)
    expect(selected.savedSettings).toBe(published)
    expect(selected.dirty).toBe(true)
  })

  it('本地内容与服务端一致时保持已保存状态', () => {
    const selected = selectInitialSettings(
      { draft: null, published, rollback: null },
      localDraft(structuredClone(published)),
    )

    expect(selected.settings).toBe(published)
    expect(selected.dirty).toBe(false)
    expect(selected.source).toBe('published')
  })

  it('保留只有全局主题的服务端草稿', () => {
    const draft: UserPagesSettings = {
      ...published,
      theme: { fontFamily: 'Huninn' },
    }
    const selected = selectInitialSettings({ draft, published, rollback: null }, null)

    expect(selected.settings).toBe(draft)
    expect(selected.source).toBe('draft')
  })

  it('服务端已变化时忽略基于旧版本的本地内容', () => {
    const currentDraft: UserPagesSettings = {
      ...published,
      home: { mode: 'legacy', title: '服务端当前版本' },
      theme: { fontFamily: 'Huninn' },
    }
    const staleLocal: UserPagesSettings = {
      ...published,
      pages: { works: { mode: 'legacy', title: '旧本地修改' } },
    }
    const selected = selectInitialSettings({ draft: currentDraft, published, rollback: null }, localDraft(staleLocal))

    expect(selected.settings).toBe(currentDraft)
    expect(selected.dirty).toBe(false)
    expect(selected.source).toBe('draft')
    expect(selected.conflict?.settings).toBe(staleLocal)
  })

  it('旧版未知基线的本地内容保留为待处理冲突', () => {
    const staleLocal: UserPagesSettings = {
      ...published,
      pages: { works: { mode: 'legacy', title: '旧版本地修改' } },
    }
    const selected = selectInitialSettings(
      { draft: null, published, rollback: null },
      { settings: staleLocal, baseSnapshot: null },
    )

    expect(selected.settings).toBe(published)
    expect(selected.conflict?.settings).toBe(staleLocal)
  })

  it('服务端没有配置时仅恢复基于空服务端的本地内容', () => {
    const local: UserPagesSettings = {
      ...published,
      pages: { works: { mode: 'legacy', title: '首次本地修改' } },
    }
    const selected = selectInitialSettings(
      { draft: null, published: null, rollback: null },
      { settings: local, baseSnapshot: '' },
    )

    expect(selected.settings).toBe(local)
    expect(selected.dirty).toBe(true)
    expect(selected.conflict).toBeNull()
  })
})
