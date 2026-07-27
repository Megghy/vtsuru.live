import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { describe, expect, it } from 'vitest'
import { selectInitialSettings } from '../useUserPageStateLoader'
import { getUserPagesLocalDraftKey } from '../useUserPagesLocalDraftStorage'

const published: UserPagesSettingsV1 = {
  version: 1,
  home: { mode: 'legacy' },
  pages: {},
}

describe('user page local draft recovery', () => {
  it('账号 key 相互隔离', () => {
    expect(getUserPagesLocalDraftKey(1)).not.toBe(getUserPagesLocalDraftKey(2))
  })

  it('本地内容与服务端不同时恢复本地内容并保持未保存状态', () => {
    const local: UserPagesSettingsV1 = {
      ...published,
      pages: { works: { mode: 'legacy', title: '本地修改' } },
    }
    const selected = selectInitialSettings({ draft: null, published, rollback: null }, local)

    expect(selected.settings).toBe(local)
    expect(selected.savedSettings).toBe(published)
    expect(selected.dirty).toBe(true)
  })

  it('本地内容与服务端一致时保持已保存状态', () => {
    const selected = selectInitialSettings({ draft: null, published, rollback: null }, structuredClone(published))

    expect(selected.settings).toBe(published)
    expect(selected.dirty).toBe(false)
    expect(selected.source).toBe('published')
  })
})
